# SPEC · NWP-201 — Issue virtual cards from the console

> Written before any code. Generated with `/spec`, then edited as needed.
> Load it as context when you build: `@docs/specs/NWP-201-issue-cards.md`

**Ticket:** [NWP-201](../tickets/NWP-201.md)  
**Branch:** `NWP-201-issue-cards`  
**Status:** draft  

---

## Problem

Ops currently issues virtual cards by messaging the platform team, who create them by hand. This takes hours, happens 12–20 times per week, and last month two cards were created with the wrong spend limit. Virtual cards are used for vendor subscriptions, ad spend, and contractor tools; they are single-merchant and need a limit from the moment they exist.

**Solution:** Add a card issuance interface to the console so ops can issue, list, and view cards without leaving the app.

---

## Current state

The console has no card support yet. Related patterns:

- **Types:** `src/data/types.ts` defines `Payment`, `Refund`, `Dispute`, `Payout` with common fields (id, merchantId, amount, currency, createdAt). Card type will follow the same pattern.
- **Store:** `src/data/store.ts` initializes data in memory from JSON, stores arrays of payments, refunds, disputes, payouts. Cards array will be added here.
- **Routes:** `src/app/api/payments/export/route.ts` shows the validation pattern: allowlist on client input, early rejection with 400 error and JSON message.
- **Merchants:** `src/data/merchants.ts` defines an array of fictional merchants with id, name, country, timezone, currency, riskTier.
- **Money:** `src/lib/money.ts` formats amounts; `src/lib/csv.ts` handles serialization. Amounts are always integer minor units (e.g., 25000 for $250.00).
- **Card rules:** `.claude/rules/cards.md` specifies: 4242 test BIN only, Luhn check digit, full number revealed once, masked as `•••• 4242` everywhere else, status state machine.

---

## Domain rules

| Rule | Source | Violation |
| --- | --- | --- |
| **Money is integer minor units.** `$250.00` is `25000`. | `CLAUDE.md`, `NWP-201` | Float arithmetic, string amounts, division by 100 outside formatters. |
| **Format once, at the edge.** Formatter output never goes back into arithmetic or storage. | `CLAUDE.md` | A formatted string used in a query or comparison. |
| **Card numbers are masked everywhere except creation response.** Store last four and reference. | `.claude/rules/cards.md`, `NWP-201` | Full number persisted, returned in list/detail, left in client state. |
| **Status is a state machine.** `active ⇄ frozen`, either to `cancelled`, `cancelled` terminal. | `.claude/rules/cards.md`, `NWP-201` | Transition logic in UI only, not guarded on server. |
| **Generated numbers use the 4242 test BIN with valid Luhn check digit.** | `.claude/rules/cards.md`, `NWP-201` | A number not starting `4242`, or failing Luhn validation. |
| **Validate on the server.** Merchant (allowlist), limit (> 0, ≤ 5,000,000), currency (USD, EUR, GBP). | `NWP-201` | Client input reaching the store without allowlist validation. |

---

## Approach

Cards are a new entity alongside payments, refunds, disputes, payouts. The implementation follows the existing patterns:

1. **Type definition** — Add `Card` interface to `src/data/types.ts` with id, nickname, merchantId, limit (integer minor units), currency, last4, status, createdAt, and spend (cumulative).
2. **Store** — Initialize an empty cards array in `src/data/store.ts`, same pattern as other entities.
3. **Luhn generator** — Create `src/lib/card-generation.ts` with a function to generate 4242 BIN numbers with valid check digits and a function to validate them. Test in isolation.
4. **API routes** — Create `src/app/api/cards/route.ts` with POST (issue card) and GET (list). Validate merchant, limit, currency server-side. POST returns the full number once; GET returns masked.
5. **Detail route** — Add `src/app/api/cards/[id]/route.ts` for GET with full card record (no full number, only last4).
6. **UI** — Create `src/app/cards/` with page.tsx (list), [id]/page.tsx (detail), and a dialog/form to issue cards.

**Considered and rejected:** Building a separate query builder for cards. Cards are simple CRUD with no filtering, sorting, or pagination complexity. The payment query builder is not reusable here and would be overkill.

---

## File map

| File | Add or change | Why |
| --- | --- | --- |
| `src/data/types.ts` | Add `CardStatus` enum, `Card` interface | Define the card entity and state machine. |
| `src/data/store.ts` | Add cards array to Store, initialize in createStore | Persist cards for the dev server session. |
| `src/lib/card-generation.ts` | Create | Generate 4242 BIN numbers with valid Luhn check digits. |
| `src/lib/card-generation.test.ts` | Create | Unit test the Luhn algorithm and generation. |
| `src/app/api/cards/route.ts` | Create | POST to issue a card (validate, generate, store, return full number once). GET to list all cards (no full numbers). |
| `src/app/api/cards/[id]/route.ts` | Create | GET a single card by id (resolve merchant name, no full number). |
| `src/app/cards/page.tsx` | Create | List cards with nickname, merchant, masked number, limit, status, created date. |
| `src/app/cards/[id]/page.tsx` | Create | Show card detail, spend against limit, status. |
| `src/app/cards/IssueCardDialog.tsx` | Create | Form/dialog to issue a card: nickname, merchant select, limit (number), currency (select). |

---

## Plan

Sequence for verification: server-side logic first, then routes, then UI.

1. **Card type and store** — Add `CardStatus = "active" | "frozen" | "cancelled"` and `Card` interface to types. Add cards array to store, initialize empty. Done when: TypeScript checks pass, store initializes.

2. **Luhn generator** — Implement `generateCard4242()` (generates 4242 BIN with valid check digit) and `validateLuhn()` (validates check digit). Write unit test with known good numbers (e.g., 4242 4242 4242 4242 3). Done when: `npm test` passes for card-generation.test.ts.

3. **POST /api/cards route** — Accept nickname, merchantId, limit (minor units), currency. Validate: merchantId against merchants array, limit > 0 and ≤ 5,000,000, currency in ["USD", "EUR", "GBP"]. Generate number, store card with last4 only, return JSON with full number + card fields. Done when: `curl -X POST` returns full number, second curl returns the card in the list without fullNumber.

4. **GET /api/cards routes** — List returns all cards (no full numbers, only last4). Detail returns one card by id, resolve merchant name. Done when: `curl http://localhost:3000/api/cards` returns masked cards, detail shows all fields.

5. **Card list UI** — Create `/cards` page, fetch GET /api/cards, render table: nickname, merchant, masked number, limit, status, created date. Done when: Browser shows list with created cards.

6. **Issue card form** — Dialog with fields: nickname (text), merchant (select), limit (number), currency (select). Submit POSTs to /api/cards. On success, show full number once. Close and refresh list. Done when: Form works, card appears in list, full number is not visible on refresh.

7. **Card detail UI** — Open card from list, show all fields, spend against limit. Optionally add freeze/unfreeze button (stretch goal). Done when: Browser navigates to detail, all fields visible.

8. **Luhn unit tests** — Add tests for generation (4242 BIN, valid check digit, deterministic) and validation. Add stretch goal tests for status transitions if time allows. Done when: `npm test` includes card tests.

---

## Verification

| Acceptance criterion | How it is proven |
| --- | --- |
| **Issue a card** — Form creates and lists the card | Submit form with nickname, merchant, limit, currency. Confirm card appears in /cards list. |
| **Card list at /cards** — Shows nickname, merchant, masked number, limit, status, date | Navigate to /cards, verify all columns present and populated. No full card numbers visible. |
| **Card detail** — Opens card, shows full record and spend | Click card in list, verify detail page shows all fields. Spend displays. |
| **Generated numbers** — 4242 BIN, valid Luhn check digit | POST creates card. curl response includes fullNumber starting with 4242. Luhn unit test validates check digit. |
| **Reveal once, mask forever** — Full number on success, `•••• 4242` elsewhere | On form success screen, full number visible. Refresh browser, navigate to detail: only masked number shown. List never shows full number. |
| **Server validation** — Rejects missing merchant, zero/negative limit, limit > 5M, invalid currency | curl with missing merchantId returns 400. curl with limit -1 returns 400. curl with currency "XYZ" returns 400. All return JSON error message. |

---

## Risks

- **Luhn algorithm bug:** A wrong check digit breaks generation. Mitigate: Write unit test first with known good numbers, verify before moving to API.
- **Full number leakage:** Card object returned from POST includes full number, but GET responses return the same object with full number. Mitigate: Filter response in GET routes, never store fullNumber in card record.
- **Validation bypass:** Limit or currency validation only on client. Mitigate: All validation server-side in POST handler, before store.write.
- **State machine not guarded:** Freeze/unfreeze allowed on cancelled card. Mitigate: Server-side status transition logic, tested separately.

---

## Out of scope

- **Persistence.** Cards live in-memory for the dev server session. Real persistence (database, migrations) is NWP-203. Do not add an ORM.
- **Authentication and roles.** No per-merchant filtering, no ops-only access control.
- **Real card network calls.** No issuer API, no real PAN generation.
- **Editing card limits.** Card limits are immutable after issue. Editing is NWP-202.
- **Category lock.** Merchant category chosen at issue time (stretch goal only).
- **Freeze/unfreeze without reload.** State transition with PATCH and client-side state update (stretch goal only).
- **Spend progress bar.** Visual indicator of spend as % of limit, turning amber > 80% (stretch goal only).

---

## Open questions

None. The ticket is clear, the patterns exist, and the rules are explicit in the codebase.

---

**Load this spec as context before building:** `@docs/specs/NWP-201-issue-cards.md`
