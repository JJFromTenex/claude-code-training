# SPEC · NWP-201 — Issue virtual cards from the console

> Written before any code. Generated with `/spec`, then edited by a human.
> Load it as context when you build: `@docs/specs/NWP-201-issue-cards.md`

**Ticket:** [NWP-201](../tickets/NWP-201.md)
**Author:** Claude Haiku 4.5
**Status:** draft

## Problem

Ops staff create virtual cards by messaging the platform team by hand, taking hours and happening 12–20 times per week. Two cards last month were created with the wrong spend limit because the request was in a Slack thread. Merchants need these cards for vendor subscriptions and ad spend, with a limit from the moment the card exists.

## Current state

- **Types:** `src/data/types.ts` defines Payment, Refund, Dispute, and Payout types, but no Card type exists.
- **Store:** `src/data/store.ts` holds arrays for payments, refunds, disputes, and payouts, but no cards array.
- **Money helpers:** `src/lib/money.ts` provides `formatMoney()`, `formatMoneyCompact()`, and `parseAmountToMinorUnits()` — amounts are integer minor units everywhere.
- **Date helpers:** `src/lib/dates.ts` provides `formatDate()` for display and works in UTC.
- **API patterns:** `src/app/api/payments/route.ts` shows a simple GET handler; validation and filtering happen in `src/data/queries.ts`.
- **UI patterns:** `src/app/payments/page.tsx` shows server-side data fetching, Table component, and StatusBadge for state display.
- **Components:** `src/components/` provides Button, Input, Select, Table, Badge, Dialog primitives built on Tremor/Radix.
- **Sidebar:** `src/components/ui/navigation/AppSidebar.tsx` defines the main navigation; cards will be a new nav item.

**No card routes, pages, or components exist yet.** The app references cards nowhere.

## Domain rules

| Rule | Source | What breaks if ignored |
| --- | --- | --- |
| Money is integer minor units (e.g., $250.00 = 25000) | `merchant-console/CLAUDE.md` + `money.md` rule | Cents drift on totals; formatting errors |
| Generated card numbers use 4242 test BIN + valid Luhn check | `merchant-console/CLAUDE.md` + `cards.md` rule | Real PAN leaks; test data becomes production-like |
| Full number revealed exactly once, in creation response only | `cards.md` rule | Plaintext card numbers persist; security leak |
| Mask everywhere else as `•••• 4242` | `cards.md` rule | Full numbers visible on list/detail; data exposure |
| Status is a state machine: `active ⇄ frozen`, either to `cancelled`, `cancelled` terminal | `merchant-console/CLAUDE.md` + `cards.md` rule | Invalid state transitions; frozen card becomes uncancellable |
| Validate on server (merchant, limit 0–5M minor units, currency USD/EUR/GBP) | `api-routes.md` rule | Invalid data reaches the store; client input is not trusted |

## Approach

Build a complete card issuance flow: a Card type with generation and state tracking, API endpoints to create and list cards, and UI for ops to issue and inspect them.

**Card type** will live in `src/data/types.ts` and hold: id, merchantId, nickname, last4, masked last4 display, spend limit (minor units), currency, status, and createdAt.

**Server-side Luhn generator** in `src/lib/luhn.ts` will create test numbers starting with 4242 and compute the check digit; it will never run in the browser.

**API routes** will handle POST `/api/cards` (create with validation), GET `/api/cards` (list by merchant), and GET `/api/cards/[id]` (detail with spend calculation). All validation will reject early; status machine transitions will be guarded server-side.

**UI** will mirror the payments flow: a list at `/cards`, a detail page at `/cards/[id]`, and a modal form to issue. The creation response shows the full number exactly once; the list and detail mask it.

**Considered and rejected:** persisting full card numbers in the database (breaks the rule; storage is for last4 only) and client-side Luhn checking (validation is server-side only per `api-routes.md`).

## File map

| File | Add or change | Why |
| --- | --- | --- |
| `src/data/types.ts` | Add Card interface | Defines card shape: id, merchantId, nickname, last4, spend limit, currency, status, createdAt |
| `src/data/store.ts` | Add cards array | Holds all created cards in memory |
| `src/lib/luhn.ts` | Create new file | Generates test card numbers with 4242 BIN and valid Luhn check digit; test alongside it |
| `src/app/api/cards/route.ts` | Create new file | POST creates a card (validate input, generate number, return full number once); GET lists cards |
| `src/app/api/cards/[id]/route.ts` | Create new file | GET returns card detail (masked number) and spend total |
| `src/app/cards/page.tsx` | Create new file | Lists all issued cards: nickname, merchant, masked number, spend limit, status, created date |
| `src/app/cards/[id]/page.tsx` | Create new file | Shows card detail, full record, and spend-against-limit progress |
| `src/components/cards/IssuanceForm.tsx` | Create new file | Modal form: nickname, merchant dropdown, spend limit input, currency select |
| `src/components/cards/CardStatusBadge.tsx` | Create new file | Render card status (active/frozen/cancelled) as badge |
| `src/components/ui/navigation/AppSidebar.tsx` | Modify | Add Cards link to sidebar nav |

## Plan

1. **Add Card type and store** — done when: `src/data/types.ts` has a Card interface with all required fields, `src/data/store.ts` initializes a `cards` array, and TypeScript compiles.

2. **Build Luhn generator** — done when: `src/lib/luhn.ts` exports `generateCardNumber()` returning a valid 4242-prefixed number, and `src/lib/luhn.test.ts` passes tests for Luhn validity and BIN prefix.

3. **Build POST /api/cards** — done when: calling `POST /api/cards` with `{ merchantId, nickname, limit, currency }` validates inputs (merchant exists, limit 0–5M, currency in allowlist), generates a card, stores it, and returns the full number in a creation response.

4. **Build GET /api/cards** — done when: calling `GET /api/cards` returns all cards (or filter by merchantId query param), with masked numbers and no full card data.

5. **Build GET /api/cards/[id]** — done when: calling `GET /api/cards/[id]` returns a single card's detail, masked number, and sum of associated spend (if spend tracking exists; if not, return 0).

6. **Build cards list page** — done when: `/cards` route renders a table showing all cards with columns for nickname, merchant, masked number, spend limit, status, and created date; clicking a card opens its detail.

7. **Build card detail page** — done when: `/cards/[id]` shows the full card record, masked number, and a progress bar (stretch) or spend total.

8. **Build issue form component** — done when: a modal form on the list page takes merchant (dropdown), nickname, limit (input), and currency (select), validates client-side as UX aid, and calls POST /api/cards; success shows the full number once, then returns to the list.

9. **Wire sidebar** — done when: Cards appears in the sidebar nav under Operations or a relevant section.

10. **Add tests for Luhn and state machine** (stretch) — done when: `npm test` passes unit tests for Luhn check digit validity and card status transitions.

## Verification

| Acceptance criterion | How it is proven |
| --- | --- |
| Issue a card via form | Fill and submit the issue form; card appears in the list immediately |
| Card list shows all issued cards | Navigate to `/cards`; all issued cards appear with nickname, merchant, masked number, limit, status, created date |
| Card detail shows full record and spend | Click a card in the list; detail page shows masked number, limit, status, created date, and spend against limit |
| Numbers generated server-side with valid Luhn and 4242 BIN | `npm test` passes Luhn tests; creation response contains a number starting `4242` and passing Luhn check |
| Full number revealed once, on success | After creation, the success modal shows the full number; closing it returns to list where it is masked |
| Server validates merchant, limit, currency | Attempt invalid submissions (missing merchant, negative/zero/overly-large limit, invalid currency); POST rejects with a clear error message |
| State machine guards status transitions (stretch) | Freeze a card from the list (PUT/PATCH with no reload); verify status changes to `frozen`; verify `frozen` can return to `active` or move to `cancelled` |

## Risks

- **Card number persistence:** If a developer stores the full number in the card record, it persists and leaks. Mitigated by storing only `last4` on the Card type; tests and code review will catch it.
- **State machine violations:** A transition not checked on the server could allow `cancelled` to return to `active`. Mitigated by guarding all transitions server-side and testing the state graph.
- **Money math:** Limits or spend could be stored as floats or misformatted. Mitigated by using the existing `formatMoney()` and `parseAmountToMinorUnits()` helpers and following the money rule.
- **Merchant validation:** A request with a non-existent merchantId should be rejected. Mitigated by checking `merchants.find()` server-side and returning 400.

## Out of scope

- **Persistence (NWP-203):** Cards live in memory and reset on server restart. No database, ORM, or migrations.
- **Real card network calls:** No issuer integration; cards are issued in the console only.
- **Authentication and roles:** All ops staff see all cards; no permission checks.
- **Editing limits post-issue (NWP-202):** Spend limit is set at creation only.
- **Stretch goals (5 optional points):** Freeze/unfreeze without reload, spend progress bar, merchant category lock, empty/error states, tests — pursue only after core is solid.

## Open questions

- **Spend tracking:** Does the app currently track card spend (transactions against a card)? If not, the detail page will show spend as 0 for now; a future ticket will wire it.
- **Merchant dropdown:** Should the form filter the merchant list (autocomplete), or show all merchants? Assuming all for now; can refine based on UX feedback.
