# SPEC · NWP-201 — Issue virtual cards from the console

> Written before any code. Generated with `/spec`, then edited by a human.

**Ticket:** [NWP-201](../tickets/NWP-201.md)
**Author:** Dhruv Shankpal
**Status:** done

## Problem

Ops issues virtual cards by messaging the platform team, who create them by hand. It takes
hours, it happens twelve to twenty times a week, and last month two cards went out with the
wrong spend limit. Marcus Bell wants issuing in the console, so an ops person does it
themselves and a bad limit is rejected before a card exists.

## Current state

- There is no cards feature. `src/app/` has overview, payments, disputes and payouts;
  `merchant-console/CLAUDE.md` says outright that cards "does not exist yet".
- The store is an in-memory object pinned to `globalThis` in `src/data/store.ts`, holding
  `merchants, payments, refunds, disputes, payouts`. There is no `cards` array and no write
  path anywhere — `src/app/api/payments/route.ts` and `src/app/api/payments/export/route.ts`
  are both GET, and neither has an error branch, so this ticket sets the error shape.
- Money helpers already exist in `src/lib/money.ts`: `formatMoney`, `sumMinorUnits`, and
  `parseAmountToMinorUnits`, which is the only sanctioned client-input to minor-units path.
- Date helpers exist in `src/lib/dates.ts`: `utcDayKey`, `formatDate`, `formatInZone`.
- Masking is already an idiom: `src/app/payments/page.tsx:123` renders
  `` `${payment.cardBrand} •••• ${payment.last4}` ``.
- `src/data/merchants.ts` carries each merchant's `currency` and `timezone`. There is no
  `category` field, so a category lock has to be a card field with its own allowlist.
- `src/components/ui/payments/StatusBadge.tsx` keys three `Record<AnyStatus, …>` maps; a new
  status set has to be added to all three or the build fails.
- `vitest.config.ts` globs `src/**/*.test.ts` — a `.test.tsx` file is silently never run, so
  anything that needs a test has to live in a `.ts` module.

## Domain rules

| Rule | Source | What breaks if ignored |
| --- | --- | --- |
| "Money is integer minor units. `$250.00` is `25000`. No floats, no strings with currency symbols. Format once, at the edge" | `merchant-console/CLAUDE.md` | A limit drifts by a cent and the card authorises the wrong amount |
| "Never store, compare, or accumulate an amount as a float" | `.claude/rules/money.md` | Silent rounding in the one number the ticket exists to get right |
| "Test BIN only. Every generated number starts `4242` and carries a valid Luhn check digit" | `.claude/rules/cards.md` | Something in the repo resembles a real PAN |
| "Generate on the server. A card number produced in the browser is a bug" | `.claude/rules/cards.md` | The number is guessable and the client is trusted with issuing |
| "Reveal once … not on the card record, not in a list or detail payload, not left in client state after the success screen closes" | `.claude/rules/cards.md` | A full PAN becomes readable forever from a list endpoint |
| "Status is a state machine: `active ⇄ frozen`, either to `cancelled`, and `cancelled` is terminal … Guard the transition on the server, not only in the UI" | `merchant-console/CLAUDE.md`, `.claude/rules/cards.md` | A cancelled card comes back to life on a crafted request |
| "Validate on the server. Anything from the client … is checked against an allowlist" | `merchant-console/CLAUDE.md` | The client is the enforcement, which it never is |
| "Storage and bucketing are UTC. Display converts to the merchant's timezone" | `merchant-console/CLAUDE.md` | Created dates land on the wrong day for Berlin and London |

## Approach

Put every rule on the server and let the UI be a thin caller. Pure logic — Luhn, masking,
the transition matrix, the spend percentage — goes in `src/lib/cards.ts` with no store
access, so it is unit-testable directly. Store access and the one place a number is
generated go in `src/data/cards.ts`; `createCard` returns `{ card, fullNumber }` so the full
number leaves as a return value and is never assigned to the record — the `Card` type has no
field for it, which is what makes "mask forever" structural rather than a habit. Two routes:
`POST /api/cards` validates and issues, `PATCH /api/cards/[id]/status` guards the machine.
The drawer derives the currency from the chosen merchant and the server verifies it anyway.

**Considered and rejected:** a React Server Action instead of a route handler. It would have
been fewer lines, but the ticket's own rule is that the client is not trusted, and a route
handler is the thing you can `curl` — the validation table below is proven against real HTTP
responses rather than asserted. Also rejected: seeding demo cards so the list opens with
rows. Nothing in scope produces card spend, so any seeded `spent` would be invented, and the
console would be showing a number that is not real.

## File map

| File | Add or change | Why |
| --- | --- | --- |
| `src/data/types.ts` | change | `Card`, `CardEvent`, `CardStatus`, `CardCategory`. `Card` has `last4` and `numberRef`, never the number |
| `src/data/store.ts` | change | `cards`, `cardEvents`, `cardKeys` arrays on the existing in-memory store |
| `src/lib/cards.ts` | add | Luhn, generation on the 4242 BIN, masking, the transition matrix, spend percent |
| `src/lib/cards.test.ts` | add | The rules above, including a second Luhn written independently |
| `src/data/cards.ts` | add | Store reads, `createCard`, the guarded transition, the idempotency ledger |
| `src/app/api/cards/route.ts` | add | `GET` list, `POST` issue with the full validation table |
| `src/app/api/cards/[id]/status/route.ts` | add | `PATCH` freeze / unfreeze / cancel through the guard |
| `src/app/cards/page.tsx` | add | The `/cards` list, with its written empty state |
| `src/app/cards/issue-drawer.tsx` | add | The issue form and the one-time reveal |
| `src/app/cards/row-actions.tsx` | add | Freeze / unfreeze / cancel without a page reload |
| `src/app/cards/cancel-confirm.ts` | add | The two-click cancel's arm and disarm rules, as a pure reducer so it is testable |
| `src/app/cards/cancel-confirm.test.ts` | add | Those rules |
| `src/app/cards/[id]/page.tsx` | add | Full record, spend against the limit, audit trail |
| `src/components/ui/payments/StatusBadge.tsx` | change | Card statuses into all three maps |
| `src/components/ui/navigation/Breadcrumbs.tsx`, `AppSidebar.tsx`, `src/app/siteConfig.ts` | change | A `/cards` section the console can navigate to |
| `src/data/queries.ts`, `src/data/metrics.ts`, `src/data/metrics.test.ts` | change / add | Four pre-existing defects found while reading (see the PR) |

## Plan

1. Types and store arrays. *Done when:* `npx tsc --noEmit` is clean with a `cards` array on the store.
2. `src/lib/cards.ts` and its tests. *Done when:* generated numbers start `4242`, are 16 digits, and pass a Luhn written separately in the test; the 3×3 transition matrix asserts `cancelled` is terminal.
3. `src/data/cards.ts`. *Done when:* `createCard` returns the number and the stored record has no field that could hold it.
4. The two routes. *Done when:* every row of the Verification table answers with the stated status over `curl`, before any component exists.
5. List, drawer and detail. *Done when:* a card can be issued, revealed once, and read back masked.
6. Freeze / unfreeze / cancel from the list. *Done when:* the badge changes with no navigation entry added.
7. The four pre-existing defects, each with a test. *Done when:* `npm test` is green and the new tests fail if the fix is reverted.

## Verification

| Acceptance criterion | How it is proven |
| --- | --- |
| Issue a card | Browser: the drawer submits, the success screen appears, the card is in the list |
| Card list at `/cards` | Browser: nickname, merchant, masked number, limit, status, created date |
| Card detail | Browser: full record, spend against the limit, audit trail |
| Generated numbers | `src/lib/cards.test.ts`, plus an independent Luhn run over a live response |
| Reveal once, mask forever | `grep` for the full number in the list JSON, the list HTML and the detail HTML: zero hits |
| Server-side validation | `curl` each rejection: missing merchant, limit `0`, `-1`, `5000001`, a float, currency `JPY`, and a currency the merchant does not settle in |
| State machine | `curl` freeze → unfreeze → freeze → cancel → freeze, expecting `409` after cancel |
| Money in minor units | `src/lib/money.test.ts` unchanged and green; limits parsed by the existing `parseAmountToMinorUnits` |

## Risks

- Deriving the card's currency from the merchant is stricter than the ticket asks. A card in
  a currency its merchant cannot settle is a payout problem later, so the server rejects it;
  relaxing it is one condition in `src/app/api/cards/route.ts`.
- `spent` is always `0` because nothing in scope captures against a card. The bar and the
  amber threshold read from the record, so they are correct on any card; they are just never
  exercised live. Inventing spend to demonstrate the bar would put a false number on screen.
- Tailwind cannot compile a runtime-computed width, so the bar's fill snaps to 5% steps from
  a literal class list. The percentage printed beside it is exact.

## Out of scope

Persistence of any kind — no database, no ORM, no migration; cards vanish on restart and
real persistence is NWP-203. Auth and roles. Real card network calls. Editing a limit after
issue, which is NWP-202.

## Open questions

- Should a frozen card still count toward a merchant's issued-card total on the overview?
  Not asked for, not built.
- The category lock list is invented here (`advertising`, `software`, `travel`,
  `office`, `subscriptions`) because merchants carry no category. Ops should own that vocabulary before it grows.
