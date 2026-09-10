# SPEC · NWP-201 — Issue virtual cards from the console

> Written before any code. Generated with `/spec`, then edited by a human.
> Load it as context when you build: `@docs/specs/NWP-201-issue-cards.md`

**Ticket:** [NWP-201](../tickets/NWP-201.md)
**Author:** Mahmood Mahmood
**Status:** building

## Problem

Ops asks the platform team to create virtual cards by hand. It takes hours, happens twelve to twenty times a week, and last month two cards shipped with the wrong limit because the request lived in a Slack thread. Marcus wants ops to issue, list and open cards themselves.

## Current state

- `src/app/` has overview, payments, disputes and payouts but no `/cards` route or card component; `src/app/api/` has only `payments/route.ts` and `payments/export/route.ts`, both `GET`, so no mutating handler, no POST precedent and no error body exist. This ticket sets one.
- `src/data/types.ts`: `CURRENCIES`, `CARD_STATUSES`, `CARD_CATEGORIES`, `MAX_SPEND_LIMIT`, `CardEvent`, `Card`. `Card` stores `last4` and `numberRef`, never a number; `Payment` has no `cardId`, so spend cannot be derived.
- `src/data/store.ts`: in-memory, empty `cards: Card[]`, cached on `globalThis.__northwindStore`, so an older dev server needs restarting.
- `src/data/merchants.ts`: ten merchants with `currency` and `timezone`, plus `merchantById`. Nothing validates currency against the merchant's.
- `src/data/queries.ts` and `src/data/metrics.ts`, neither tested: `sortPayments` compares amounts as strings, so `9000` sorts above `25000`, and `dailyVolume` buckets server-local not UTC while accumulating major units as floats.
- `src/components/Drawer.tsx`: Radix Dialog underneath, giving dialog role, accessible title, focus trap and Escape. It is the only overlay in `src/components/`, and the `Dialog` that `.claude/rules/components.md` names does not exist.
- `src/components/Input.tsx` renders no label, so labels are written explicitly; `src/components/ui/payments/StatusBadge.tsx` spans payment, dispute and payout statuses via `AnyStatus`.

## Domain rules

| Rule | Source | What breaks if ignored |
| --- | --- | --- |
| "Money is integer minor units... Format once, at the edge" | `.claude/rules/money.md`, `ORG-STANDARDS.md` #1 | Limits drift by cents |
| "validated and converted at the boundary, once" | `.claude/rules/money.md` | Two parsers disagree on the limit |
| "returned exactly once, in the creation response. After that, last four only" | `.claude/rules/cards.md`, `ORG-STANDARDS.md` #8 | A PAN stays readable from a payload |
| "Mask everywhere else as `•••• 4242`" | `.claude/rules/cards.md` | Sensitive data leaks into a table |
| "`active ⇄ frozen`, either to `cancelled`... Guard on the server" | `.claude/rules/cards.md` | A cancelled card is reactivated by curl |
| "starts `4242` and carries a valid Luhn check digit... Generate on the server" | `.claude/rules/cards.md` | Something resembles a real PAN |
| "Validate everything from the client against an allowlist" | `.claude/rules/api-routes.md`, `ORG-STANDARDS.md` #7 | A POST sets a huge limit or `JPY` |
| "Return the same error shape everywhere" | `.claude/rules/api-routes.md` | Every caller parses errors differently |

Also binding: UTC storage, merchant-timezone display (`ORG-STANDARDS.md` #4-5), labelled inputs, written empty and error states (`.claude/rules/components.md`).

## Approach

Cards follow the shape payments use: types and store in `src/data/`, pure logic in `src/lib/cards.ts` with a test beside it, `src/data/cards.ts` holding queries and the one write path, thin route handlers over it, server components reading the store. `src/lib/cards.ts` owns the Luhn generator, mask, transitions and spend ratio, with no store access. `src/data/cards.ts` owns `listCards`, `cardById`, `issueCard` and `changeCardStatus`, and is the only place validation lives. The number is generated inside `issueCard`, returned only by `POST /api/cards`, rendered only on the success screen. `issue-card-drawer.tsx` and `card-actions.tsx` call the API then `router.refresh()`. `spent` renders as 0 with the detail page saying why, since `Payment` has no `cardId`, and `Drawer.tsx` stands in for the missing `Dialog`.

**Considered and rejected:**

- A separate `CardStatusBadge`: `StatusBadge.tsx` already unions three status families, so a fourth is three map entries and a parallel one would drift.
- A server-side idempotency map: invisible state, and `Card` already carries `idempotencyKey`, so scanning `store.cards` keeps the evidence on the record.
- Storing a hash of the number: nothing verifies numbers and a 16-digit space hashes reversibly, so it is a stored PAN with extra steps.

## File map

| File | Add or change | Why |
| --- | --- | --- |
| `src/data/types.ts` | changed | Card types and constants |
| `src/data/store.ts` | changed | `cards` array |
| `src/lib/cards.ts` + `.test.ts` | add | Generator, mask, transitions |
| `src/data/cards.ts` + `.test.ts` | add | Queries, validation, idempotency |
| `src/app/api/cards/route.ts` | add | GET list, POST issue |
| `src/app/api/cards/[id]/route.ts` | add | GET detail, PATCH status |
| `src/app/cards/page.tsx` | add | List and empty state |
| `src/app/cards/issue-card-drawer.tsx` | add | Labelled form, reveal once |
| `src/app/cards/card-actions.tsx` | add | Freeze, unfreeze, cancel |
| `src/app/cards/[id]/page.tsx` + `spend-progress.tsx` | add | Detail and timeline |
| `src/components/ui/payments/StatusBadge.tsx` | changed | Card statuses in `AnyStatus` |
| `siteConfig.ts`, `AppSidebar.tsx`, `Breadcrumbs.tsx` | changed | Nav and crumb |
| `src/data/queries.ts`, `src/data/metrics.ts` + tests | changed / add | The two defects |

## Plan

1. **`src/lib/cards.ts` with tests.** Done when `npm test` shows `4242` Luhn-valid numbers, `•••• 4242` masking, and illegal transitions refused.
2. **`src/data/cards.ts` with tests.** Done when an unknown merchant, blank nickname, `0`, `-1`, `5_000_001`, a bad or mismatched currency are each rejected, a valid call appends one card with `spent: 0`, and a repeated key mints nothing.
3. **Route handlers.** Done when POST returns 201 with the number, GET returns `last4` only, a bad limit 400s with `{ error }`, an unknown id 404s and PATCH on a cancelled card 409s.
4. **`/cards` list and nav.** Done when the page appears in sidebar and breadcrumb, shows the empty state on a fresh server, and lists nickname, merchant, mask, limit, badge and date, newest first.
5. **`issue-card-drawer.tsx`.** Done when a card is issued in the browser, the number shows once, closing clears it, the list refreshes, every field has a label.
6. **`card-actions.tsx` and `[id]/page.tsx`.** Done when freeze and unfreeze flip the badge with no reload, cancel needs a confirm then disables both, and detail shows the record, a 0% bar and the timeline in merchant time.
7. **The two defects, tests first.** Done when `queries.test.ts` and `metrics.test.ts` fail on amount ordering and UTC bucketing plus floats, then pass, with `npm test` green.

## Verification

| Acceptance criterion | How it is proven |
| --- | --- |
| Issue a card (core) | Submit the drawer, the new row appears |
| Card list (core) | `/cards` shows nickname, merchant, mask, limit, status, date |
| Card detail (core) | `/cards/<id>` shows the record and spend |
| `4242` BIN and Luhn (core) | `src/lib/cards.test.ts` prefix and check digit |
| Reveal once, mask forever (core) | Success screen shows it, curl on both routes has no number, reopening is empty |
| Server-side validation (core) | `src/data/cards.test.ts` per input, plus curl with `0`, `5000001`, `JPY`, no merchant, all 400 |
| Freeze and unfreeze (stretch) | Badge changes via `router.refresh()`, transitions tested |
| Spend progress, amber past 80% (stretch) | `src/lib/cards.test.ts` at 79, 80, 100% |
| Merchant category lock (stretch) | Drawer choice, rejected outside `CARD_CATEGORIES` in `src/data/cards.test.ts` |
| Tests on generator and transitions (stretch) | `npm test` green, tests beside the code |
| Empty and error states (stretch) | Fresh server shows the empty state, a rejected submit shows `error` |
| Idempotent retry | `src/data/cards.test.ts`, same key twice, one card, no number |
| Currency matches merchant | `src/data/cards.test.ts`, GBP merchant, USD limit, rejected |
| Planted defects | `queries.test.ts` and `metrics.test.ts` fail, then pass |

## Risks

- The store is cached on `globalThis` (`src/data/store.ts`), so an older dev server has no `cards`; restart it, and say so in the PR body.
- Thirteen files is the whole budget, so no new dependencies.
- Rules files load only when a matching file is opened, so anyone editing `src/app/api/cards/` may miss the rules quoted above.
- The success screen is the only place a PAN exists in the browser, so not clearing drawer state on close re-reveals it, which is a rule violation.

## Out of scope

Persistence (NWP-203), editing a limit after issue (NWP-202), auth, real issuer calls, expiry and CVC, pagination and filtering, seed cards (the store boots empty by design), and `grossVolume` refund handling in `src/data/metrics.ts`, raised below.

## Open questions

- Is the limit monthly, yearly, or lifetime? Building a lifetime cap, the only reading needing no reset.
- Should `grossVolume` in `src/data/metrics.ts` include refunded payments? Not touching it without an answer.
- Who issued a card? `CardEvent` records what and when but not who, and there is no auth.
