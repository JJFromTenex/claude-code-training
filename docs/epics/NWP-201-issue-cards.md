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
  `disputes`, `payouts`. There was no `cards` slot and nothing in the store
  references a card.
- `src/data/types.ts` — the shape of every record, with doc comments carrying
  the domain rules (`/** Integer minor units. Never a float. */`). No `Card`.
- `src/data/merchants.ts` — six fictional merchants, each with a `currency` and
  an IANA `timezone`. `merchantById(id)` is the existing lookup.
- `src/lib/money.ts:15,41,46` — `formatMoney`, `sumMinorUnits`, and
  `parseAmountToMinorUnits`. The last already does the one legal
  string→minor-units conversion, so nothing new parses an amount.
- `src/lib/dates.ts:27,35` — `formatInZone` (the merchant's timezone, for
  detail pages) and `formatDate` (UTC, for tables).
- `src/app/api/payments/route.ts` and `src/app/api/payments/export/route.ts` —
  the only two route handlers, both `GET`. **There is no POST route anywhere in
  this app yet**, and neither existing route has a 4xx path, so the error shape
  `.claude/rules/api-routes.md` mandates gets its first implementation here.
- `src/app/payments/page.tsx:57-135` — the list-page pattern: an async server
  component reading the store directly, `<section aria-label>`, `TableRoot` /
  `Table`, a written empty-state row at `:93-103`, `StatusBadge`, and
  `formatMoney` called in the cell rather than upstream.
- `src/app/payments/[id]/page.tsx:19-21,126-140` — the detail pattern:
  `await params`, `notFound()` on a miss, a local `Field` helper over a `dl`,
  and a timeline rendered as an `ol`.
- `src/app/payments/filter-bar.tsx` — the colocated `"use client"` pattern:
  interactive leaf next to the page it serves, `useRouter` for the refresh.
- `src/components/Drawer.tsx:11,126` — the Radix Dialog shell (focus trap,
  focus return, Escape) exported as `Drawer*`.
- `src/components/ui/payments/StatusBadge.tsx:10,12,30,48` — a status union and
  three `Record<AnyStatus, …>` maps. Because they are `Record`s, widening the
  union without adding a label, dot, and variant is a compile error rather than
  a blank badge.
- `vitest.config.ts:13-14` — `environment: "node"`,
  `include: ["src/**/*.test.ts"]`.
  Component tests are not collected; only pure logic is testable here.

**Where the ticket and the code disagree:** `.claude/rules/components.md` says
`src/components/` already has "Button, Input, Select, Dialog, Badge". There is
no `Dialog` component. `Drawer.tsx` is the Radix Dialog wrapper and is what the
issue form is built on. Flagged rather than worked around.

**Found on the way in:** `sortPayments` in `src/data/queries.ts:72-84` compared
amounts as text (`String(a.amount).localeCompare(...)`), so `994` sorted after
`9873`. Fixed with a numeric compare at `:82` and a regression test in the
first commit of this branch; it is not part of NWP-201's scope but it is in
this branch's diff, so it is called out here and in the PR.

## Domain rules

Quoted, not paraphrased.

| Rule | Source | What breaks if ignored |
| --- | --- | --- |
| "Money is integer minor units. `$250.00` is `25000`." | `merchant-console/CLAUDE.md` | A limit stored as `250.0` drifts, and the 5,000,000 ceiling stops meaning anything |
| "Never parse a currency string into a number… it is validated and converted at the boundary, once." | `.claude/rules/money.md` | A second parser disagrees with `parseAmountToMinorUnits` on `"250.005"` |
| "Every generated number starts `4242` and carries a valid Luhn check digit." | `.claude/rules/cards.md` | Something in the repo resembles a real PAN |
| "Generate on the server. A card number produced in the browser is a bug." | `.claude/rules/cards.md` | The number the client claims is the number stored |
| "Reveal once. The full number appears in the creation response and nowhere else: not on the card record, not in a list or detail payload, not left in client state after the success screen closes." | `.claude/rules/cards.md` | A PAN becomes re-readable, which is the whole thing this rule exists to stop |
| "Status is a state machine. `active ⇄ frozen`, either to `cancelled`, and `cancelled` is terminal. Guard the transition on the server, not only in the UI." | `.claude/rules/cards.md` | A cancelled card comes back to life from a replayed request |
| "Validate everything from the client against an allowlist… Client-side checks are a convenience, never the enforcement." | `.claude/rules/api-routes.md` | curl issues a €50,000,000 card in a currency the merchant does not settle in |
| "Return the same error shape everywhere: a status code that means what it says, and a body with a message safe to show a user." | `.claude/rules/api-routes.md` | The drawer has nothing honest to render when a request fails |
| "Tailwind only. No inline `style` attributes." | `.claude/rules/components.md` | The spend bar is the obvious place to reach for `style={{width}}` |
| "Storage and bucketing are UTC. Display converts to the merchant's timezone." | `merchant-console/CLAUDE.md` | `createdAt` means a different day depending on where the server sits |

## Approach

Cards get the same three-layer shape as payments: types and store slot in
`src/data/`, pure logic in `src/lib/`, routes under `src/app/api/`, and server
components under `src/app/cards/` that read the store directly. Card number
generation and the status state machine are both pure functions with no store
import, which is what makes them testable under a node-environment vitest.
`POST /api/cards` is the only response in the application that ever carries a
full number; the record it stores holds `last4` and an opaque `numberRef` and
never the PAN, so masking is a property of the data rather than a discipline
applied at each render site. Status changes go through `PATCH /api/cards/[id]`,
which asks the same `canTransition` the tests cover, so the UI hiding a button
and the server rejecting the request are two expressions of one rule.

**Considered and rejected:**

- *`GET /api/cards` list and detail routes.* Rejected: the pages are server
  components, and every existing page (`src/app/payments/page.tsx`,
  `src/app/disputes/page.tsx`) reads the store directly. A read route nothing
  calls is dead code, and `.claude/rules/components.md` says to keep fetching
  out of components "where a route handler already returns what you need" —
  here nothing needs one.
- *Optimistic freeze/unfreeze state in the client.* Rejected: the store is
  in-memory and answers instantly, so `router.refresh()` after the PATCH is
  both simpler and truthful. Optimistic state would introduce a second source
  of truth for a status the server owns.
- *An `ExportDialog`-style dialog component.* Rejected: there is no `Dialog`
  primitive in this tree (see above). `Drawer.tsx` is the Radix Dialog wrapper
  and already gives focus trap, focus return, Escape, and an accessible name.
- *Deriving `spent` from payments.* Rejected: nothing in the store links a
  payment to a card, so any derivation would be invented. `spent` is stored,
  starts at `0`, and is rendered from the stored value.
- *A percentage in an inline `style` for the spend bar.* Rejected by
  `components.md`. The bar snaps to 5% steps mapped to static Tailwind widths,
  and the two comparisons behind it (`spendBarSteps`, `isNearLimit`) live in
  `src/lib/cards.ts` so they can be unit-tested: `spent` is always zero in this
  app, so the amber threshold has no other way to be proven.

## File map

| File | Add or change | Why |
| --- | --- | --- |
| `src/data/types.ts` | change | `CardStatus`, `CardCategory`, `Card` — the shape, with the minor-units and UTC rules in doc comments like their neighbors |
| `src/data/store.ts` | change | `cards: Card[]` slot, plus a `??=` guard for a hot-reloaded store created before this change |
| `src/lib/cards.ts` | add | `luhnCheckDigit`, `isLuhnValid`, `generateCardNumber`, `maskCardNumber`, and the spend-bar comparisons `spendBarSteps` and `isNearLimit` — all pure, no store import |
| `src/lib/cards.test.ts` | add | 4242 prefix, 16 digits, Luhn validity, mutated digits rejected, and the eighty-percent boundary |
| `src/data/cards.ts` | add | Category allowlist, limit ceiling, `TRANSITIONS`/`canTransition`/`applyTransition`, and the store operations `listCards`, `cardById`, `cardByRequestId`, `issueCard` |
| `src/data/cards.test.ts` | add | The full transition matrix, and that an issued record carries no PAN |
| `src/app/api/cards/route.ts` | add | `POST` — allowlist validation, idempotent replay, the one full-number response |
| `src/app/api/cards/[id]/route.ts` | add | `PATCH` — server-side transition guard, 400/404/409 |
| `src/app/cards/page.tsx` | add | The list: nickname, merchant, masked number, limit, spend, category, status, created |
| `src/app/cards/[id]/page.tsx` | add | The detail: full record, spend against limit, status history |
| `src/app/cards/issue-card-drawer.tsx` | add | The issue form and the one-time reveal |
| `src/app/cards/card-row-actions.tsx` | add | Freeze / unfreeze / cancel without a page reload |
| `src/app/cards/spend-progress.tsx` | add | Spend bar, amber past 80%, no inline style |
| `src/components/ui/payments/StatusBadge.tsx` | change | Extend `AnyStatus` with `CardStatus` and fill all three Records |
| `src/app/siteConfig.ts`, `src/components/ui/navigation/AppSidebar.tsx` | change | Register `/cards` in the nav |
| `src/data/queries.ts`, `src/data/queries.test.ts` | change | The text-sorted amounts fix described above |

## Plan

Server first, so every step ends somewhere a command can prove.

1. **Types and store slot** — done when: `npx tsc --noEmit` is clean with
   `Card` in `Store`.
2. **Luhn helpers and their test** — done when: `npm test` shows
   `src/lib/cards.test.ts` green, including a mutated-digit rejection.
3. **Data module and the transition test** — done when: `npm test` covers the
   whole matrix and `cancelled` refuses every outbound transition.
4. **`POST /api/cards`** — done when: curl returns 201 with a 4242-prefixed
   Luhn-valid number, each rejection returns 400 with a message, a mismatched
   currency is refused, and a replayed `requestId` returns the same card with
   no full number.
5. **`PATCH /api/cards/[id]`** — done when: curl walks active→frozen→active→
   cancelled, and cancelled→active returns 409.
6. **StatusBadge and nav** — done when: the sidebar shows Cards and `tsc` is
   clean.
7. **List page and spend bar** — done when: `/cards` renders the written empty
   state on a fresh boot and a full row after a card exists.
8. **Issue drawer** — done when: the browser shows the number once, the list
   refreshes on close, and a server rejection renders in the alert region.
9. **Detail page** — done when: an unknown id 404s and a known one shows the
   record, the spend bar, and the status history.
10. **Row actions** — done when: the badge flips with no page reload and a
    cancelled row has no toggle left.
11. **Sweep** — done when: `npm test` and `npx tsc --noEmit` are green, there is
    no `console.log`/`TODO` in `src`, and `fullNumber` appears only in the
    creation path.

## Verification

| Acceptance criterion | How it is proven |
| --- | --- |
| Issue a card | Browser: drawer submit, card appears in the list |
| `/cards` list with every column | Browser: the row shows nickname, merchant, `•••• 4242`, limit, status, created |
| Card detail with spend against limit | Browser: `/cards/card_0001` |
| Server-side 4242 + Luhn | `src/lib/cards.test.ts`, plus the number in the curl 201 |
| Reveal once | `grep -rn fullNumber src` reaches only the creation route and the drawer; list, detail, and PATCH responses carry `last4` |
| Server-side validation | curl for each rejection: missing merchant, zero, negative, over 5,000,000, bad currency |
| Freeze and unfreeze without a reload | Browser: the badge flips in place |
| Spend progress amber past 80% | `isNearLimit` in `src/lib/cards.test.ts`, asserting 80% is not past it and 80.01% is, in integers |
| Category lock | Chosen in the drawer, allowlisted on the server, shown in the list and detail |
| Tests | `npm test` summary line in the PR |
| Empty and error states | Browser: empty `/cards`, and a forced 400 in the drawer |
| State machine | `src/data/cards.test.ts` matrix, plus curl 409 on cancelled→active |
| Currency matches the merchant | curl a EUR limit against a USD merchant → 400 |
| Idempotent issue | curl the same `requestId` twice → one card |

## Risks

- **Next 15 async `params`.** Both the detail page and the PATCH handler take
  `params: Promise<{ id: string }>` and must `await` it. Mitigated by copying
  `src/app/payments/[id]/page.tsx`, which already does.
- **A hot-reloaded store from before this change** has no `cards` array and
  would throw on first write. Mitigated with `store.cards ??= []` after the
  store resolves; a dev-server restart also clears it.
- **Vitest does not collect `.test.tsx`.** All tests here are pure logic, so no
  behavior depends on a component test that would never run.
- **Reveal-once leaks** are the failure mode with real consequences: the PAN
  must not reach a log, a URL, the idempotent replay response, or retained
  client state after the drawer closes. Checked by grep and by closing the
  drawer and reopening it.

## Out of scope

- **Persistence** — NWP-203. No database, no ORM, no migration.
- **Editing a limit after issue** — NWP-202.
- Authentication, roles, permissions.
- Real card network calls. There is no issuer.
- `GET /api/cards` — no caller, so it would ship as dead code.

## Open questions

- `spent` has no source in this app: nothing in the store links a payment to a
  card. It is stored as `0` at issue and rendered from the stored value rather
  than derived from something that would be invented. Whether spend arrives
  from an authorization feed later is a question for NWP-203 and after.
- Category is an allowlist chosen at issue time and displayed. Whether it
  should ever be enforced against an authorization is not answerable until
  there are authorizations.
