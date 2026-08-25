# NWP-201 · Issue virtual cards from the console

## Problem

Ops issues virtual cards by messaging the platform team in Slack — 12-20 times per week, taking hours, and last month two cards were created with the wrong spend limit because the request was buried in a thread. Merchants need these for vendor subscriptions, ad spend, and contractor tools.

## Current state

- No `/cards` route exists (`src/app/siteConfig.ts:4-9` lists overview, payments, disputes, payouts)
- No card type in `src/data/types.ts`
- No card storage in `src/data/store.ts`
- Existing infrastructure to reuse:
  - `src/lib/money.ts` — `formatMoney()` for display, `parseAmountToMinorUnits()` for form input
  - `src/data/merchants.ts` — `merchants` array, `merchantById()` for validation and display
  - `src/data/types.ts` — `Currency` type already defined as `"USD" | "EUR" | "GBP"`
  - `src/components/` — Button, Input, Select, Badge, Table, Drawer (Radix-based)
  - `src/components/ui/payments/StatusBadge.tsx` — pattern for status display with Badge
  - `src/lib/dates.ts` — `formatDate()` for table columns

## Domain rules

1. **Money is integer minor units.** A `$250.00` limit is `25000`. Format once at the edge via `formatMoney()`.
2. **4242 test BIN.** Every generated number starts `4242`, carries a valid Luhn check digit, and is 16 digits.
3. **Reveal once.** The full card number appears in the POST creation response only. The `VirtualCard` type has no field for it — masking is structural, not procedural.
4. **State machine.** `active ⇄ frozen`, either → `cancelled` (terminal). Guarded server-side.
5. **Validate on the server.** Reject missing merchant, unknown merchant, zero/negative limit, limit > 5,000,000, non-integer limit, invalid currency, currency-merchant mismatch.

## Approach

### Data layer

Add `CardStatus` and `VirtualCard` to `src/data/types.ts`. The card has no full-number field — only `last4`. Add `cards: VirtualCard[]` to the store (starts empty). Create `src/data/cards.ts` for the card query/mutation layer: `validateIssueInput()`, `createCard()`, `transitionCard()`, idempotency key tracking.

### Luhn and card generation

`src/lib/luhn.ts` — pure functions: `luhnCheckDigit(partial)`, `isValidLuhn(number)`, `generateCardNumber()`. Uses `randomBytes` from Node's `crypto` module server-side. `src/lib/cards.ts` — `canTransition(from, to)`, `maskCardNumber(last4)`. Both with test files beside them.

### API routes

- `POST /api/cards` — validates body, creates card, returns 201 with full number (reveal-once). Checks `Idempotency-Key` header.
- `GET /api/cards` — returns all cards, masked.
- `GET /api/cards/[id]` — returns one card with spend info, masked.
- `PATCH /api/cards/[id]` — status transition, guarded by state machine.

### UI

- `/cards` — server component, table with empty state
- `/cards/[id]` — server component, detail with spend progress bar and status history
- `issue-card.tsx` — client Drawer form with reveal-once success screen
- `card-actions.tsx` — client component for freeze/unfreeze/cancel-with-confirm

### Navigation

Add `cards: "/cards"` to `siteConfig.baseLinks`. Add Cards entry to sidebar with `Wallet` icon.

## File map

| File | Action | Purpose |
|------|--------|---------|
| `src/data/types.ts` | Modify | Add `CardStatus`, `VirtualCard`, `CardCategory` |
| `src/data/store.ts` | Modify | Add `cards` to Store, add `issuedKeys` map |
| `src/lib/luhn.ts` | Create | Luhn check digit, validation, card number generation |
| `src/lib/luhn.test.ts` | Create | 200-iteration BIN/Luhn validation, edge cases |
| `src/lib/cards.ts` | Create | Status transitions, masking |
| `src/lib/cards.test.ts` | Create | Exhaustive transition matrix, mask format |
| `src/data/cards.ts` | Create | Card CRUD, validation, idempotency, spend |
| `src/data/cards.test.ts` | Create | Validation cases, idempotency, spend derivation |
| `src/app/api/cards/route.ts` | Create | GET list + POST create |
| `src/app/api/cards/[id]/route.ts` | Create | GET detail + PATCH transition |
| `src/components/ui/cards/CardStatusBadge.tsx` | Create | Status badge for card statuses |
| `src/components/ui/cards/SpendProgress.tsx` | Create | Progress bar, amber >80%, red >=100% |
| `src/app/cards/page.tsx` | Create | Card list with empty state |
| `src/app/cards/[id]/page.tsx` | Create | Card detail with spend and history |
| `src/app/cards/issue-card.tsx` | Create | Issue form in Drawer, reveal-once success |
| `src/app/cards/card-actions.tsx` | Create | Freeze/unfreeze/cancel with confirmation |
| `src/app/siteConfig.ts` | Modify | Add cards link |
| `src/components/ui/navigation/AppSidebar.tsx` | Modify | Add Cards nav |

## Sequenced plan

1. Types and store — `VirtualCard` with no full number field, `cards[]` in store
2. Luhn generator and card rules — pure functions with tests
3. Card data layer — validation, CRUD, idempotency, spend derivation, with tests
4. API routes — GET/POST/PATCH with server-side validation
5. UI components — status badge, spend progress bar
6. Card pages — list, detail, issue form, actions
7. Navigation — sidebar and siteConfig

## Out of scope

- Persistence (NWP-203)
- Authentication and permissions
- Real card network calls
- Editing a card's limit after issue (NWP-202)
