# EPIC · NWP-201 — Issue virtual cards from the console

> Written before any code. Load it as context when you build:
> `@docs/epics/NWP-201-issue-cards.md`

**Ticket:** [NWP-201](../tickets/NWP-201.md)
**Author:** Alexander Ramirez
**Status:** done

## Problem

Ops issues virtual cards by messaging the platform team, who create them by
hand. It takes hours, happens twelve to twenty times a week, and last month two
cards went out with the wrong spend limit because the request lived in a Slack
thread. Marcus wants the request, the record, and the limit in one place, so the
card that exists is the card that was asked for.

## Current state

Every claim here was read out of the tree, not assumed.

- `src/data/store.ts:16-36` — the in-memory store on
  `globalThis.__northwindStore`, holding `merchants`, `payments`, `refunds`,
  `disputes`, `payouts`. No `cards` slot; nothing in the store references a card.
- `src/data/types.ts` — every record's shape, with the domain rules in doc
  comments (`/** Integer minor units. Never a float. */`). No `Card`.
- `src/data/merchants.ts` — six fictional merchants, each with a `currency` and
  an IANA `timezone`. `merchantById(id)` is the existing lookup.
- `src/lib/money.ts:15,41,46` — `formatMoney`, `sumMinorUnits`,
  `parseAmountToMinorUnits`. The last already does the one legal
  string→minor-units conversion, so nothing new parses an amount.
- `src/lib/dates.ts:27,35` — `formatInZone` (merchant timezone, detail pages)
  and `formatDate` (UTC, tables).
- `src/app/api/payments/route.ts`, `src/app/api/payments/export/route.ts` — the
  only route handlers, both `GET`. **No POST route exists anywhere yet**, and
  neither has a 4xx path, so the error shape `.claude/rules/api-routes.md`
  mandates gets its first implementation here.
- `src/app/payments/page.tsx:57-135` — the list pattern: async server component
  reading the store directly, `<section aria-label>`, `TableRoot`/`Table`, a
  written empty-state row at `:93-103`, `StatusBadge`, `formatMoney` in the cell.
- `src/app/payments/[id]/page.tsx:19-21,126-140` — the detail pattern:
  `await params`, `notFound()` on a miss, a local `Field` helper over a `dl`.
- `src/app/payments/filter-bar.tsx` — the colocated `"use client"` pattern:
  interactive leaf beside the page it serves, `useRouter` for the refresh.
- `src/components/Drawer.tsx:11,126` — the Radix Dialog shell (focus trap,
  focus return, Escape).
- `src/components/ui/payments/StatusBadge.tsx:10,12,30,48` — a status union and
  three `Record<AnyStatus, …>` maps, so widening the union without adding a
  label, dot, and variant is a compile error rather than a blank badge.
- `vitest.config.ts:13-14` — `environment: "node"`,
  `include: ["src/**/*.test.ts"]`. Component tests are not collected; only pure
  logic is testable here.

**Where the ticket and the code disagree:** `.claude/rules/components.md` says
`src/components/` has "Button, Input, Select, Dialog, Badge". There is no
`Dialog`. `Drawer.tsx` is the Radix Dialog wrapper and is what the form is built
on. Flagged rather than worked around.

**Found on the way in:** `sortPayments` in `src/data/queries.ts:72-84` compared
amounts as text (`String(a.amount).localeCompare(...)`), so `994` sorted after
`9873`. Fixed with a numeric compare at `:82` plus a regression test, in the
first commit of this branch. Out of NWP-201's scope but in its diff, so it is
named here and in the PR.

## Domain rules

Quoted, not paraphrased.

| Rule | Source | What breaks if ignored |
| --- | --- | --- |
| "Money is integer minor units. `$250.00` is `25000`." | `merchant-console/CLAUDE.md` | A limit stored as `250.0` drifts, and the 5,000,000 ceiling stops meaning anything |
| "Never parse a currency string into a number… validated and converted at the boundary, once." | `.claude/rules/money.md` | A second parser disagrees with `parseAmountToMinorUnits` on `"250.005"` |
| "Every generated number starts `4242` and carries a valid Luhn check digit." | `.claude/rules/cards.md` | Something in the repo resembles a real PAN |
| "Generate on the server. A card number produced in the browser is a bug." | `.claude/rules/cards.md` | The number the client claims is the number stored |
| "Reveal once. The full number appears in the creation response and nowhere else: not on the card record, not in a list or detail payload, not left in client state after the success screen closes." | `.claude/rules/cards.md` | A PAN becomes re-readable, which is the whole point of the rule |
| "Status is a state machine. `active ⇄ frozen`, either to `cancelled`, and `cancelled` is terminal. Guard the transition on the server, not only in the UI." | `.claude/rules/cards.md` | A cancelled card comes back to life from a replayed request |
| "Validate everything from the client against an allowlist… Client-side checks are a convenience, never the enforcement." | `.claude/rules/api-routes.md` | curl issues a €50,000,000 card in a currency the merchant does not settle in |
| "Return the same error shape everywhere: a status code that means what it says, and a body with a message safe to show a user." | `.claude/rules/api-routes.md` | The drawer has nothing honest to render when a request fails |
| "Tailwind only. No inline `style` attributes." | `.claude/rules/components.md` | The spend bar is the obvious place to reach for `style={{width}}` |
| "Storage and bucketing are UTC. Display converts to the merchant's timezone." | `merchant-console/CLAUDE.md` | `createdAt` means a different day depending on where the server sits |

## Approach

Cards take the same three layers as payments: types and store slot in
`src/data/`, pure logic in `src/lib/`, routes under `src/app/api/`, and server
components under `src/app/cards/` reading the store directly. Number generation
and the status machine are pure functions with no store import, which is what
makes them testable under a node-environment vitest. `POST /api/cards` is the
only response in the application that ever carries a full number; the record it
stores holds `last4` and an opaque `numberRef`, so masking is a property of the
data rather than a discipline applied at each render site. Status changes go
through `PATCH /api/cards/[id]`, which asks the same `canTransition` the tests
cover, so the UI hiding a button and the server refusing a request are two
expressions of one rule.

**Considered and rejected:**

- *`GET /api/cards` routes.* The pages are server components and every existing
  page (`src/app/payments/page.tsx`, `src/app/disputes/page.tsx`) reads the
  store directly. A read route nothing calls is dead code, and
  `.claude/rules/components.md` says to keep fetching out of components "where a
  route handler already returns what you need" — nothing here needs one.
- *Optimistic freeze/unfreeze state.* The store answers instantly, so
  `router.refresh()` after the PATCH is simpler and truthful. Optimistic state
  would be a second source of truth for a status the server owns.
- *An `ExportDialog`-style dialog component.* There is no `Dialog` primitive in
  this tree. `Drawer.tsx` already gives focus trap, focus return, Escape, and an
  accessible name.
- *Deriving `spent` from payments.* Nothing links a payment to a card, so any
  derivation would be invented. `spent` is stored, starts at `0`, and is
  rendered from the stored value.
- *A percentage in an inline `style` for the spend bar.* Rejected by
  `components.md`. The bar snaps to 5% steps mapped to static Tailwind widths,
  and the two comparisons behind it (`spendBarSteps`, `isNearLimit`) live in
  `src/lib/cards.ts` so they can be unit-tested: `spent` is always zero in this
  app, so the amber threshold has no other way to be proven.

## File map

| File | Add or change | Why |
| --- | --- | --- |
| `src/data/types.ts` | change | `CardStatus`, `CardCategory`, `Card`, with the minor-units and UTC rules in doc comments like their neighbors |
| `src/data/store.ts` | change | `cards: Card[]` slot, plus a `??=` guard for a hot-reloaded store predating it |
| `src/lib/cards.ts` + `.test.ts` | add | `luhnCheckDigit`, `isLuhnValid`, `generateCardNumber`, `maskCardNumber`, `spendBarSteps`, `isNearLimit` — all pure, no store import |
| `src/data/cards.ts` + `.test.ts` | add | Category allowlist, limit ceiling, `TRANSITIONS`/`canTransition`/`applyTransition`, and the store operations |
| `src/app/api/cards/route.ts` | add | `POST` — allowlist validation, idempotent replay, the one full-number response |
| `src/app/api/cards/[id]/route.ts` | add | `PATCH` — server-side transition guard, 400/404/409 |
| `src/app/cards/page.tsx` | add | The list, with a written empty state |
| `src/app/cards/[id]/page.tsx` | add | The detail: full record, spend against limit, status history |
| `src/app/cards/issue-card-drawer.tsx` | add | The issue form and the one-time reveal |
| `src/app/cards/card-row-actions.tsx` | add | Freeze / unfreeze / cancel without a page reload |
| `src/app/cards/spend-progress.tsx` | add | Spend bar, amber past 80%, no inline style |
| `src/components/ui/payments/StatusBadge.tsx` | change | Widen `AnyStatus` with `CardStatus`, fill all three Records |
| `src/app/siteConfig.ts`, `AppSidebar.tsx` | change | Register `/cards` in the nav |
| `src/data/queries.ts` + `.test.ts` | change | The text-sorted amounts fix above |

## Plan

Server first, so each step ends where a command can prove it.

1. **Types and store slot** — `npx tsc --noEmit` clean with `Card` in `Store`.
2. **Luhn helpers + test** — `npm test` green, including a mutated-digit rejection.
3. **Data module + test** — the whole transition matrix, `cancelled` refusing every outbound move.
4. **`POST /api/cards`** — curl: 201 with a 4242-prefixed Luhn-valid number; each rejection 400 with a message; a mismatched currency refused; a replayed `requestId` returning the same card with no full number.
5. **`PATCH /api/cards/[id]`** — curl: active→frozen→active→cancelled, and cancelled→active 409.
6. **StatusBadge + nav** — sidebar shows Cards, `tsc` clean.
7. **List page + spend bar** — written empty state on a fresh boot, a full row after a card exists.
8. **Issue drawer** — number shown once, list refreshed, a server 400 rendered in the alert region.
9. **Detail page** — unknown id 404s; a known one shows record, spend bar, status history.
10. **Row actions** — badge flips with no reload, a cancelled row keeps no toggle.
11. **Sweep** — tests and `tsc` green, no `console.log`/`TODO` in `src`, `fullNumber` only in the creation path.

## Verification

| Acceptance criterion | How it is proven |
| --- | --- |
| Issue a card | Browser: drawer submit, card appears in the list |
| `/cards` list with every column | Browser: nickname, merchant, `•••• 4242`, limit, status, created |
| Card detail with spend against limit | Browser: `/cards/card_0001` |
| Server-side 4242 + Luhn | `src/lib/cards.test.ts`, plus the number in the curl 201 |
| Reveal once | `grep -rn fullNumber src` reaches only the creation route and the drawer; list, detail, and PATCH carry `last4` |
| Server-side validation | curl each rejection: missing merchant, zero, negative, over 5,000,000, bad currency |
| Freeze and unfreeze without a reload | Browser: the badge flips in place |
| Spend progress amber past 80% | `isNearLimit` in `src/lib/cards.test.ts`: 80% is not past it, 80.01% is, in integers |
| Category lock | Chosen in the drawer, allowlisted on the server, shown in list and detail |
| Tests | `npm test` summary line in the PR |
| Empty and error states | Browser: empty `/cards`, and a forced 400 in the drawer |
| State machine | `src/data/cards.test.ts` matrix, plus curl 409 on cancelled→active |
| Currency matches the merchant | curl a EUR limit against a USD merchant → 400 |
| Idempotent issue | curl the same `requestId` twice → one card |

## Risks

- **Next 15 async `params`.** The detail page and the PATCH handler both take
  `params: Promise<{ id: string }>` and must `await` it. Mitigated by copying
  `src/app/payments/[id]/page.tsx`, which already does.
- **A hot-reloaded store from before this change** has no `cards` array and
  would throw on first write. Mitigated with `store.cards ??= []`.
- **Vitest does not collect `.test.tsx`.** All tests here are pure logic, so
  nothing depends on a component test that would never run.
- **Reveal-once leaks** are the failure mode with real consequences: no PAN in a
  log, a URL, the idempotent replay response, or retained client state.

## Out of scope

- **Persistence** — NWP-203. No database, no ORM, no migration.
- **Editing a limit after issue** — NWP-202.
- Authentication, roles, permissions.
- Real card network calls. There is no issuer.
- `GET /api/cards` — no caller, so it would ship as dead code.

## Open questions

- `spent` has no source: nothing links a payment to a card. It is stored as `0`
  and rendered from the stored value rather than derived from something
  invented. Whether spend arrives from an authorization feed is for NWP-203 on.
- Category is an allowlist chosen at issue and displayed. Whether it is ever
  enforced against an authorization is unanswerable until there are any.
