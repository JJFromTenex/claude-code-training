# EPIC · NWP-201 — Issue virtual cards from the console

**Ticket:** [NWP-201](../tickets/NWP-201.md) · **Author:** Alexander Ramirez · **Status:** done

## Problem

Ops issues virtual cards by messaging the platform team, who create them by hand.
It takes hours, happens twelve to twenty times a week, and last month two cards
went out with the wrong spend limit because the request lived in a Slack thread.
Marcus wants the request, the record, and the limit in one place.

## Current state

Read out of the tree, not assumed.

- `src/data/store.ts:16-36` — in-memory store on `globalThis.__northwindStore`
  holding merchants, payments, refunds, disputes, payouts. No `cards` slot.
- `src/data/types.ts` — record shapes, domain rules in doc comments
  (`/** Integer minor units. Never a float. */`). No `Card`.
- `src/data/merchants.ts` — six merchants, each with a `currency` and IANA
  `timezone`; `merchantById(id)` is the existing lookup.
- `src/lib/money.ts:15,41,46` — `formatMoney`, `sumMinorUnits`,
  `parseAmountToMinorUnits`. The last is the only legal string→minor-units
  conversion, so nothing new parses an amount.
- `src/lib/dates.ts:27,35` — `formatInZone` (merchant timezone) and `formatDate` (UTC).
- `src/app/api/payments/route.ts`, `.../export/route.ts` — the only handlers, both
  `GET`. **No POST route exists yet** and neither has a 4xx path, so the error
  shape in `.claude/rules/api-routes.md` gets its first implementation here.
- `src/app/payments/page.tsx:57-135` — the list pattern: async server component
  reading the store directly, `<section aria-label>`, `TableRoot`/`Table`, a
  written empty-state row at `:93-103`, `formatMoney` in the cell.
- `src/app/payments/[id]/page.tsx:19-21` — detail pattern: `await params`,
  `notFound()`, a local `Field` helper over a `dl`.
- `src/app/payments/filter-bar.tsx` — colocated `"use client"` leaf, `useRouter`.
- `src/components/Drawer.tsx:11,126` — the Radix Dialog shell.
- `src/components/ui/payments/StatusBadge.tsx:10,12,30,48` — a union and three
  `Record<AnyStatus, …>` maps, so widening the union without a label, dot, and
  variant is a compile error, not a blank badge.
- `vitest.config.ts:13-14` — node env, `include: ["src/**/*.test.ts"]`. Component
  tests are not collected; only pure logic is testable.

**Doc/code conflict:** `.claude/rules/components.md` claims a `Dialog` primitive.
There is none. `Drawer.tsx` is the Radix Dialog wrapper and is what the form uses.

**Found on the way in:** `sortPayments` at `src/data/queries.ts:72-84` compared
amounts as text, so `994` sorted after `9873`. Fixed numerically at `:82` with a
regression test, in this branch's first commit.

## Domain rules

| Rule | Source | What breaks if ignored |
| --- | --- | --- |
| "Money is integer minor units. `$250.00` is `25000`." | `CLAUDE.md` | A limit stored as `250.0` drifts; the 5,000,000 ceiling stops meaning anything |
| "Every generated number starts `4242` and carries a valid Luhn check digit." | `cards.md` | Something here resembles a real PAN |
| "Reveal once… not on the card record, not in a list or detail payload, not left in client state after the success screen closes." | `cards.md` | A PAN becomes re-readable |
| "Status is a state machine… `cancelled` is terminal. Guard the transition on the server, not only in the UI." | `cards.md` | A cancelled card revives from a replayed request |
| "Validate everything from the client against an allowlist… never the enforcement." | `api-routes.md` | curl issues a €50,000,000 card in the wrong currency |
| "Tailwind only. No inline `style` attributes." | `components.md` | The spend bar invites `style={{width}}` |

## Approach

Built in the order below, server first, each step ending where a command proves
it: types and store slot, Luhn helpers and their test, the data module and its
transition matrix, `POST`, `PATCH`, then the pages and the drawer, then a sweep.

Same three layers as payments: types and store slot in `src/data/`, pure logic in
`src/lib/`, routes under `src/app/api/`, server components under `src/app/cards/`
reading the store directly. Generation and the status machine are pure with no
store import, which is what makes them testable under node-env vitest.
`POST /api/cards` is the only response that ever carries a full number; the
stored record holds `last4` and an opaque `numberRef`, so masking is a property
of the data rather than a discipline repeated at each render site. Status changes
go through `PATCH /api/cards/[id]`, asking the same `canTransition` the tests
cover, so a hidden button and a refused request are one rule.

**Considered and rejected:** *`GET /api/cards`* — pages are server components and
read the store directly like `src/app/payments/page.tsx`; a route nothing calls is
dead code. *Optimistic freeze state* — the store answers instantly, so
`router.refresh()` is simpler and avoids a second source of truth for a status the
server owns. *A `Dialog` component* — none exists; `Drawer.tsx` already gives focus
trap, focus return, and Escape. *Deriving `spent`* — nothing links a payment to a
card, so it would be invented; `spent` is stored and starts at `0`. *An inline
`style` width* — forbidden by `components.md`; the bar snaps to 5% steps on static
Tailwind classes, with `spendBarSteps`/`isNearLimit` in `src/lib/cards.ts` so the
amber threshold can be unit-tested, since `spent` is always zero in the app.

## File map

| File | Add/change | Why |
| --- | --- | --- |
| `src/data/types.ts` | change | `CardStatus`, `CardCategory`, `Card`, rules in doc comments |
| `src/data/store.ts` | change | `cards: Card[]` slot, `??=` guard for a hot-reloaded store |
| `src/lib/cards.ts` + test | add | Luhn, generation, masking, spend-bar comparisons; pure |
| `src/data/cards.ts` + test | add | Allowlists, `TRANSITIONS`/`canTransition`/`applyTransition`, store ops |
| `src/app/api/cards/route.ts` | add | `POST` — validation, idempotent replay, the one full-number response |
| `src/app/api/cards/[id]/route.ts` | add | `PATCH` — server-side transition guard, 400/404/409 |
| `src/app/cards/page.tsx` | add | The list, with a written empty state |
| `src/app/cards/[id]/page.tsx` | add | Record, spend against limit, status history |
| `src/app/cards/issue-card-drawer.tsx` | add | The form and the one-time reveal |
| `src/app/cards/card-row-actions.tsx` | add | Freeze / unfreeze / cancel, no reload |
| `src/app/cards/spend-progress.tsx` | add | Spend bar, amber past 80%, no inline style |
| `StatusBadge.tsx`, `siteConfig.ts`, `AppSidebar.tsx` | change | Card statuses and `/cards` in the nav |
| `src/data/queries.ts` + test | change | The text-sorted amounts fix |

## Verification

| Criterion | Proof |
| --- | --- |
| Issue a card | Browser: drawer submit, card in the list |
| List with every column | Browser: nickname, merchant, `•••• 4242`, limit, status, created |
| Detail with spend vs limit | Browser: `/cards/card_0001` |
| Server-side 4242 + Luhn | `src/lib/cards.test.ts` over 500 draws, plus the curl 201 |
| Reveal once | `grep -rn fullNumber src` reaches only the creation route and the drawer |
| Server-side validation | curl each rejection: merchant, zero, negative, >5,000,000, bad currency |
| Freeze/unfreeze without reload | Browser: badge flips in place |
| Amber past 80% | `isNearLimit` test: 80% is not past it, 80.01% is, in integers |
| Category lock | Drawer choice, server allowlist, shown in list and detail |
| Empty and error states | Browser: empty `/cards`, forced 400 in the drawer |
| State machine | `src/data/cards.test.ts` matrix, curl 409 on cancelled→active |
| Currency matches merchant | curl EUR against a USD merchant → 400 |
| Idempotent issue | curl the same `requestId` twice → one card |

## Risks

- **Next 15 async `params`** — detail page and PATCH both take a Promise and must
  `await`. Mitigated by copying `src/app/payments/[id]/page.tsx`.
- **A hot-reloaded store predating this change** has no `cards` array. Mitigated
  with `store.cards ??= []`.
- **Vitest ignores `.test.tsx`** — all tests are pure logic, so nothing rests on a
  component test that would never run.
- **Reveal-once leaks** — no PAN in a log, a URL, the replay response, or retained
  client state.

## Out of scope

Persistence (NWP-203), editing a limit after issue (NWP-202), auth, real card
network calls, and `GET /api/cards`, which would ship as dead code.

## Open questions

`spent` has no source: nothing links a payment to a card, so it is stored as `0`
and rendered from the stored value rather than derived from something invented.
Whether spend arrives from an authorization feed is for NWP-203 on.
