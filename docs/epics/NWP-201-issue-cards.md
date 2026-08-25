# EPIC · NWP-201 — Issue virtual cards from the console

> Written before any code. Generated with `/epic`, then edited by a human.
> Load it as context when you build: `@docs/epics/NWP-201-issue-cards.md`

**Ticket:** [NWP-201](../tickets/NWP-201.md)
**Author:** Saurabh Deshpande
**Status:** draft

## Problem

Ops issues virtual cards by messaging the platform team in Slack, who create them by hand. It takes hours, happens twelve to twenty times a week, and last month two cards were created with the wrong spend limit because the request lived in a thread. Marcus Bell wants it in the console: issue a card, see the cards you issued, open one to check it.

## Current state

- `src/data/types.ts` — `Currency`, `Merchant`, `Payment`, `Dispute`, `Payout`. **There is no `Card` type and no card linkage on `Payment`** (`Payment` ends at `description`, line 36).
- `src/data/store.ts:16` — the `Store` interface holds `merchants, payments, refunds, disputes, payouts`. No `cards`. Store is pinned to `globalThis` (line 34) so dev-server reloads keep writes.
- `src/data/generate.ts:69` — deterministic generator (`mulberry32`, line 21). Payments get `method`, `cardBrand`, `last4` (lines 92–105) but no card reference. IDs are `` `pay_${pad(n)}` `` style (line 93).
- `src/data/merchants.ts` — seed array plus `merchantById` (line 90). The pattern any new seed module should copy.
- `src/data/queries.ts` — the one payment query builder (`filterPayments`, line 45) plus record accessors `paymentById` (108), `refundsForPayment` (112), `disputeForPayment` (116).
- `src/lib/money.ts` — `formatMoney` (15), `sumMinorUnits` (41), and **`parseAmountToMinorUnits` (46), which already does the string→minor-units boundary conversion the issue form needs**. Do not write a second one.
- `src/lib/dates.ts` — `formatDate` (31), `formatInZone` (22).
- `src/components/ui/payments/StatusBadge.tsx` — badge driven by exhaustive `LABELS`/`DOTS`/`VARIANTS` records over a closed `AnyStatus` union (line 5).
- `src/app/payments/page.tsx` — the list-page pattern to follow, including a written empty state (lines 93–104).
- `src/app/payments/[id]/page.tsx` — the detail-page pattern: `notFound()` on a miss (line 21), format at the edge.
- `src/app/api/payments/route.ts` — route handlers are thin; parsing and allowlisting happen in `src/data/queries.ts:18`.
- Tests are `vitest` (`package.json` `"test": "vitest run"`), config at `vitest.config.ts`, specs beside the source as `src/lib/*.test.ts`.

**Where the ticket and the rules do not match the code:**

1. `.claude/rules/components.md` says `src/components/` "already has Button, Input, Select, **Dialog**, Badge". **There is no `Dialog` component.** `src/components/Drawer.tsx` wraps `@radix-ui/react-dialog` and is the modal primitive that actually exists. Build the issue form on `Drawer`.
2. The ticket requires card detail to show "its spend against the limit", but nothing links a payment to a card. Resolved below — this is new linkage, not existing data.
3. Unrelated latent defect: `src/data/queries.ts:81` sorts amounts with `String(a.amount).localeCompare(...)`, so `9000` sorts after `10000`. Payments-side, out of scope here — flagged, not fixed.

## Domain rules

| Rule | Source | What breaks if ignored |
| --- | --- | --- |
| "Money is integer minor units. `$250.00` is `25000`. No floats, no strings with currency symbols. Format once, at the edge" | `merchant-console/CLAUDE.md` | Limits drift; a $250 card is not a $250 card |
| "Every generated number starts `4242` and carries a valid Luhn check digit. Nothing here may resemble a real PAN, ever, including in tests and fixtures" | `.claude/rules/cards.md` | The repo ships something that looks like a real PAN |
| "Generate on the server. A card number produced in the browser is a bug" | `.claude/rules/cards.md` | Number generation becomes client-trusted |
| "Reveal once. The full number appears in the creation response and nowhere else: not on the card record, not in a list or detail payload" | `.claude/rules/cards.md` | Full PANs leak from routes that should only ever return last four |
| "Status is a state machine. `active ⇄ frozen`, either to `cancelled`, and `cancelled` is terminal. Guard the transition on the server, not only in the UI" | `.claude/rules/cards.md` | A cancelled card comes back to life via a crafted request |
| "Validate everything from the client against an allowlist before it reaches the store" | `.claude/rules/api-routes.md` | Currency and limit checks become cosmetic |
| "Format money here, not upstream. Components receive minor units and a currency code" | `.claude/rules/components.md` | Two halves of the app disagree on formatting |
| "Do not add a database, an ORM, or migrations" | `merchant-console/CLAUDE.md` | Burns the clock on NWP-203's ticket |

## Approach

Cards become a first-class record in the in-memory store, seeded the way merchants are. A new `src/lib/cards.ts` owns the two pure pieces worth testing — Luhn generation on the `4242` BIN, and the status transition guard — with `src/lib/cards.test.ts` beside it. The store gains a `cards` array from a new `src/data/cards.ts` seed module; `Payment` gains `cardId`, and `src/data/generate.ts` deterministically attaches a share of card-method payments to seeded cards so spend is real rather than decorative. Spend is derived, not stored: a `spendForCard` accessor in `src/data/queries.ts` sums the card's `captured` and `authorized` payments (excluding `failed` and `refunded`) — single-merchant cards mean a single currency, so `sumMinorUnits` is safe. Three route handlers under `src/app/api/cards/` do the work: `POST` issues and returns the full number exactly once, `GET` lists and reads with last four only, and a status route guards transitions server-side. The UI is a `/cards` list, a `[id]` detail with the spend bar, and an issue form built on `Drawer`.

**Considered and rejected:** storing a `spend` integer on the card record and incrementing it. Cheaper and it would have avoided touching the generator, but it makes spend a number nobody can trace to a payment, and it invents a write path the ticket never asked for. Deriving from linked payments costs more clock and is the reason `generate.ts` is in the file map, but the detail page can then justify every figure it shows.

## File map

| File | Add or change | Why |
| --- | --- | --- |
| `src/lib/cards.ts` | Add | Luhn generator on the `4242` BIN, masking helper, transition guard — the pure logic |
| `src/lib/cards.test.ts` | Add | Unit tests for both, beside the code, matching `src/lib/money.test.ts` |
| `src/data/types.ts` | Change | `Card`, `CardStatus`, `MerchantCategory`; add `cardId` to `Payment` |
| `src/data/cards.ts` | Add | Seed cards + `cardById`, following the `merchants.ts` pattern; issue and transition writes |
| `src/data/store.ts` | Change | `cards` on the `Store` interface and in `createStore` |
| `src/data/generate.ts` | Change | Deterministically attach `cardId` to a share of card-method payments |
| `src/data/queries.ts` | Change | `spendForCard`, reusing `sumMinorUnits`; card list accessor |
| `src/app/api/cards/route.ts` | Add | `GET` list (masked), `POST` issue (full number once) |
| `src/app/api/cards/[id]/route.ts` | Add | `GET` detail, masked |
| `src/app/api/cards/[id]/status/route.ts` | Add | `POST` transition, guarded server-side |
| `src/app/cards/page.tsx` | Add | The `/cards` list with a written empty state |
| `src/app/cards/issue-drawer.tsx` | Add | Client issue form on `Drawer`, labelled inputs, success screen with the one-time reveal |
| `src/app/cards/[id]/page.tsx` | Add | Detail plus spend-against-limit bar, amber past 80% |
| `src/components/ui/payments/StatusBadge.tsx` | Change | Extend the union and its three records with card statuses rather than forking a second badge |
| `src/app/siteConfig.ts` | Change | `cards: "/cards"` in `baseLinks` |
| `src/components/ui/navigation/AppSidebar.tsx` | Change | Nav entry so the route is reachable |

## Plan

1. **Luhn and the state machine, test-first** — done when: `npm test` passes with new cases proving every generated number starts `4242`, passes a Luhn check, and that `cancelled` refuses every transition out.
2. **Types, seed, store** — done when: `src/data/cards.ts` exports seeded cards with varied statuses, currencies, and one card deliberately past 80% spend, and the store exposes them.
3. **Payment linkage and derived spend** — done when: `spendForCard` returns a non-zero, hand-checkable figure for a seeded card and `0` for one with no payments.
4. **API: list and detail** — done when: `curl /api/cards` and `/api/cards/<id>` return records whose number field is last four only, verified by grepping the response for a 16-digit run.
5. **API: issue** — done when: a valid `POST` returns a full number once and the follow-up `GET` does not; and each of the five invalid inputs (missing merchant, zero, negative, over 5,000,000, bad currency) returns a 400 with a user-safe message.
6. **API: status transitions** — done when: freeze, unfreeze, and cancel succeed in order, and a transition out of `cancelled` returns 409.
7. **List and detail pages, nav** — done when: `/cards` renders seeded cards with masked numbers and `/cards/<id>` shows the record and the spend bar in amber past 80%.
8. **Issue drawer and one-time reveal** — done when: submitting the form adds a row to the list without a reload and the full number appears on the success screen and nowhere else.
9. **Freeze/unfreeze from the list, empty and error states** — done when: toggling status updates the row without a full page reload, and the empty and failed-request states each show deliberate copy.

## Verification

| Acceptance criterion | How it is proven |
| --- | --- |
| Issue a card | Submit the drawer; the new card appears in `/cards` without a reload |
| Card list | `/cards` shows nickname, merchant, masked number, limit, status, created date for every card |
| Card detail | `/cards/<id>` renders the full record and spend against limit |
| Generated numbers | `src/lib/cards.test.ts` — `4242` prefix and Luhn check digit over many generated numbers |
| Reveal once, mask forever | Success screen shows the number; `GET /api/cards` and `/api/cards/<id>` responses contain no 16-digit run |
| Server-side validation | Five `curl` `POST`s (missing merchant, `0`, negative, `5000001`, `JPY`) each return 400 with a safe message |
| Money in minor units | No float arithmetic on limits; `formatMoney` called only in components |
| State machine | `src/lib/cards.test.ts` on the guard, plus a `POST` transition out of `cancelled` returning 409 |
| Freeze / unfreeze (stretch) | Toggle from the list row; status badge changes without a full page reload |
| Spend progress (stretch) | Seeded card past 80% renders amber; a card at 0 renders empty |
| Tests (stretch) | `npm test` green |

## Risks

- **Touching `generate.ts` is the expensive choice.** It is deterministic (`mulberry32`), so inserting a `cardId` draw shifts every subsequent random value and changes the whole seeded dataset. Mitigation: derive linkage *after* the generation loop from the finished payments array rather than drawing inside it, so existing records are untouched.
- **`StatusBadge` records are exhaustive.** Adding card statuses to the union without updating `LABELS`, `DOTS`, and `VARIANTS` together is a type error at best and a blank badge at worst.
- **The one-time reveal is easy to leak.** The full number must not be returned by list or detail, and must not be left in client state after the success screen closes. Verification step 4 greps for it deliberately.
- **45 minutes.** Steps 1–7 are the core criteria. Steps 8–9 carry stretch goals; if the clock runs out, the PR says which were reached.

## Out of scope

- Persistence of any kind — no database, ORM, or migrations. That is NWP-203.
- Authentication, roles, permissions.
- Real card network or issuer calls.
- Editing a card's limit after issue — NWP-202.
- The lexicographic amount sort at `src/data/queries.ts:81`. It is a real defect and it is payments-side; fixing it inside a cards ticket widens the diff a reviewer has to trust.

## Open questions

- **Which payment statuses count as spend?** Assumption: `captured` and `authorized` count, `failed` and `refunded` do not, and `disputed` still counts because the money has not come back. Stated in the PR if nobody corrects it.
- **Merchant category lock (stretch) has no taxonomy in the repo.** Assumption: a small server-side allowlist of plain-language categories, not real MCC codes, since nothing here may resemble real payment infrastructure.
