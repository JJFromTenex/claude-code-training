# SPEC · NWP-201 — Issue virtual cards from the console

> Written before any code. Generated with `/spec`, then edited by a human.

**Ticket:** [NWP-201](../tickets/NWP-201.md)
**Author:** Dhruv Shankpal
**Status:** done

## Problem

Ops issues virtual cards by messaging the platform team, who create them by hand. It takes
hours, happens twelve to twenty times a week, and last month two cards went out with the
wrong spend limit. Marcus Bell wants issuing in the console, so ops does it themselves and a
bad limit is refused before a card exists.

## Current state

- No cards feature. `src/app/` has overview, payments, disputes and payouts;
  `merchant-console/CLAUDE.md` says cards "does not exist yet".
- The store is an in-memory object pinned to `globalThis` in `src/data/store.ts`, holding
  `merchants, payments, refunds, disputes, payouts`. No `cards` array, and no write path
  anywhere: `src/app/api/payments/route.ts` and `src/app/api/payments/export/route.ts` are
  both GET with no error branch, so this ticket sets the error shape.
- `src/lib/money.ts` has `formatMoney`, `sumMinorUnits`, and `parseAmountToMinorUnits` — the
  only sanctioned client-input-to-minor-units path.
- `src/lib/dates.ts` has `utcDayKey`, `formatDate`, `formatInZone`.
- Masking is already an idiom: `src/app/payments/page.tsx:123` renders
  `` `${payment.cardBrand} •••• ${payment.last4}` ``.
- `src/data/merchants.ts` carries each merchant's `currency` and `timezone`. There is no
  `category` field, so a category lock needs its own allowlist.
- `src/components/ui/payments/StatusBadge.tsx` keys three `Record<AnyStatus, …>` maps; a new
  status set must be added to all three or the build fails.
- `vitest.config.ts` globs `src/**/*.test.ts`, so a `.test.tsx` is silently never run and
  anything needing a test has to live in a `.ts` module.

## Domain rules

| Rule | Source | What breaks if ignored |
| --- | --- | --- |
| "Money is integer minor units. `$250.00` is `25000`. No floats … Format once, at the edge" | `merchant-console/CLAUDE.md` | A limit drifts and the card authorises the wrong amount |
| "Never store, compare, or accumulate an amount as a float" | `.claude/rules/money.md` | Silent rounding in the one number this ticket exists to get right |
| "Test BIN only. Every generated number starts `4242` and carries a valid Luhn check digit" | `.claude/rules/cards.md` | Something here resembles a real PAN |
| "Generate on the server. A card number produced in the browser is a bug" | `.claude/rules/cards.md` | The client is trusted with issuing |
| "Reveal once … not on the card record, not in a list or detail payload, not left in client state after the success screen closes" | `.claude/rules/cards.md` | A full PAN stays readable from a list endpoint forever |
| "`active ⇄ frozen`, either to `cancelled` … Guard the transition on the server, not only in the UI" | `merchant-console/CLAUDE.md`, `.claude/rules/cards.md` | A cancelled card comes back on a crafted request |
| "Validate on the server. Anything from the client … is checked against an allowlist" | `merchant-console/CLAUDE.md` | The client becomes the enforcement, which it never is |
| "Storage and bucketing are UTC. Display converts to the merchant's timezone" | `merchant-console/CLAUDE.md` | Created dates land on the wrong day for Berlin and London |

## Approach

Put every rule on the server and let the UI be a thin caller. Pure logic — Luhn, masking,
the transition matrix, the spend percentage — goes in `src/lib/cards.ts` with no store
access, so it is testable directly. Store access, validation, and the one place a number is
generated go in `src/data/cards.ts`; `issueCard` returns `{ card, fullNumber }` so the
number leaves as a return value and is never assigned to the record. The `Card` type has no
field that could hold it, which makes "mask forever" structural rather than a habit. Two
routes: `POST /api/cards` validates and issues, `PATCH /api/cards/[id]/status` guards the
machine. The drawer derives currency from the chosen merchant and the server verifies it
anyway.

**Considered and rejected:** a Server Action instead of a route handler. Fewer lines, but
the ticket's own rule is that the client is not trusted, and a route handler is the thing
you can `curl` — the validation table below gets proven against real HTTP responses rather
than asserted. Also rejected: seeding demo cards so the list opens with rows. Nothing in
scope produces card spend, so any seeded `spent` would be invented.

## File map

| File | Add or change | Why |
| --- | --- | --- |
| `src/data/types.ts` | change | `Card`, `CardEvent`, `CardStatus`, `CardCategory`, and the allowlists the types derive from |
| `src/data/store.ts` | change | `cards`, `cardEvents`, `cardKeys` on the existing in-memory store |
| `src/lib/cards.ts` | add | Luhn, generation on the 4242 BIN, masking, the transition matrix, spend percent |
| `src/lib/cards.test.ts` | add | Those rules, including a second Luhn written independently |
| `src/data/cards.ts` | add | Validation, `issueCard`, the guarded transition, the idempotency ledger |
| `src/data/cards.test.ts` | add | The validation table, idempotency, and the state machine |
| `src/app/api/cards/route.ts` | add | `GET` list, `POST` issue |
| `src/app/api/cards/[id]/status/route.ts` | add | `PATCH` freeze / unfreeze / cancel |
| `src/app/cards/page.tsx` | add | The `/cards` list and its written empty state |
| `src/app/cards/issue-drawer.tsx` | add | The issue form and the one-time reveal |
| `src/app/cards/row-actions.tsx` | add | Freeze / unfreeze / cancel without a page reload |
| `src/app/cards/cancel-confirm.ts` + test | add | The two-click cancel's arm and disarm rules, as a pure reducer |
| `src/app/cards/spend-bar.tsx` | add | Spend against the limit, amber past 80% |
| `src/app/cards/[id]/page.tsx` | add | Full record, spend, audit trail |
| `StatusBadge.tsx`, `Breadcrumbs.tsx`, `AppSidebar.tsx`, `siteConfig.ts` | change | A `/cards` section the console can navigate to |
| `src/data/queries.ts`, `src/data/metrics.ts` + tests | change / add | Four pre-existing defects found while reading (see the PR) |

## Plan

1. Types and store arrays. *Done when:* `npx tsc --noEmit` is clean with a `cards` array on the store.
2. `src/lib/cards.ts` and its tests. *Done when:* generated numbers start `4242`, are sixteen digits, and pass a Luhn written separately in the test; the transition matrix asserts `cancelled` is terminal both ways out.
3. `src/data/cards.ts` and its tests. *Done when:* every row of the validation table below is asserted, and the stored record has no field that could hold a number.
4. The two routes. *Done when:* each of those rows answers with the stated status over `curl`, before any component exists.
5. List, drawer and detail. *Done when:* a card can be issued, revealed once, and read back masked.
6. Freeze / unfreeze / cancel from the list. *Done when:* the badge changes with no navigation entry added.
7. The four pre-existing defects, each with a test. *Done when:* the new tests go red if the fix is reverted.

## Verification

| Acceptance criterion | How it is proven |
| --- | --- |
| Issue a card | Browser: the drawer submits, the success screen appears, the card is in the list |
| Card list at `/cards` | Browser: nickname, merchant, masked number, limit, status, created date |
| Card detail | Browser: full record, spend against the limit, audit trail |
| Generated numbers | `src/lib/cards.test.ts`, plus an independent Luhn run over a live response |
| Reveal once, mask forever | `grep` for the number in the list JSON, list HTML and detail HTML: zero hits |
| Server-side validation | `curl` each rejection: missing merchant, limit `0`, `-1`, `5000001`, a float, currency `JPY`, and a currency the merchant does not settle in |
| State machine | `curl` freeze → unfreeze → freeze → cancel → freeze, expecting `409` after cancel |
| Money in minor units | `money.test.ts` unchanged and green; limits parsed by `parseAmountToMinorUnits` |

## Risks

- Deriving currency from the merchant is stricter than the ticket asks. A card in a currency
  its merchant cannot settle is a payout problem later, so the server refuses it; relaxing
  it is one condition in `src/data/cards.ts`.
- `spent` is always `0` because nothing in scope captures against a card. The bar and the
  amber threshold read the record, so they are correct on any card; they are just never
  exercised live. Inventing spend would put a false number on screen.
- Tailwind cannot compile a runtime-computed width, so the bar snaps to 5% steps from a
  literal class list. The percentage printed beside it is exact.

## Out of scope

Persistence of any kind — no database, ORM or migration; cards vanish on restart and real
persistence is NWP-203. Auth and roles. Real card network calls. Editing a limit after
issue, which is NWP-202.

## Open questions

- Should a frozen card still count toward a merchant's issued-card total on the overview?
  Not asked for, not built.
- The category vocabulary is invented here because merchants carry none. Ops should own it
  before it grows.
