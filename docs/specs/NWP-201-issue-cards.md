# SPEC · NWP-201 — Issue virtual cards from the console

> Written before any code. Load it as context when you build: `@docs/specs/NWP-201-issue-cards.md`

**Ticket:** [NWP-201](../tickets/NWP-201.md)
**Author:** tim_usmanov
**Status:** reviewed

## Problem

Ops issues virtual cards by messaging the platform team, who create them by hand. It takes hours, happens twelve to twenty times a week, and last month two cards were created with the wrong spend limit because the request lived in a Slack thread. Marcus Bell wants the request, the limit, and the card in one place, so the limit is typed into a validated field instead of a chat message.

## Current state

Every claim below was read out of the tree, not assumed.

- `src/data/store.ts` — the in-memory store, held on `globalThis.__northwindStore` so the dev server's module reloading does not hand each request a fresh copy. The `Store` interface carries `merchants`, `payments`, `refunds`, `disputes`, `payouts`. **There is no `cards` array.**
- `src/data/types.ts` — `Currency = "USD" | "EUR" | "GBP"`, `Merchant`, `Payment`, `PaymentFilters`. **No card types exist.** `Merchant.currency` is present on every merchant and is the hook for currency validation.
- `src/data/merchants.ts` — eight fictional merchants, each with its own currency: `mch_04` Halcyon Studio is GBP, `mch_05`/`mch_06` are EUR, the rest USD. `merchantById(id)` is exported and is the lookup to use.
- `src/data/queries.ts` — the one payment query builder. `parseFilters` is the allowlist-validation pattern to copy (`STATUSES.includes(...)` before anything reaches a query). `paginate<T>` is generic and reusable. Card lookups must not be bolted into this file.
- `src/lib/money.ts` — `formatMoney(minorUnits, currency)`, `formatMoneyCompact`, `sumMinorUnits`, `parseAmountToMinorUnits(input)`. The last one is the boundary converter for form input and returns `null` on anything that is not `^\d+(\.\d{1,2})?$`. **Nothing in this ticket may add a second formatter or a second parser.**
- `src/lib/dates.ts` — `formatDate(iso)` for tables (UTC), `formatInZone(iso, tz)` for merchant-local timestamps, `utcDayKey`.
- `src/app/api/payments/route.ts` — six lines: parse params, call the builder, `NextResponse.json`. New routes match this shape.
- `src/app/payments/page.tsx` — async server component. Reads `searchParams`, calls `queryPayments()` **directly** rather than fetching its own API, renders `TableRoot/Table/TableHead/TableBody`, has a written empty state in a `colSpan` row, calls `formatMoney` at the point of render. This is the template for `/cards`.
- `src/app/payments/[id]/page.tsx` — async server component, `notFound()` when the record is missing, `<dl>` of fields via a local `Field` helper, and a `timeline` array sorted by `at`. This is the template for `/cards/[id]` and for the audit trail.
- `src/components/` — Button, Input, Select, Badge, Table, Divider, Drawer, DropdownMenu, Skeleton. **`.claude/rules/components.md` claims a `Dialog` exists. It does not.** `src/components/Drawer.tsx` wraps `@radix-ui/react-dialog` and already provides the overlay, focus trap, Escape-to-close and an accessible title slot. Use `Drawer` for both the issue flow and the cancel confirmation.
- `src/components/ui/payments/StatusBadge.tsx` — one badge for all statuses, driven by `LABELS`, `DOTS` and `VARIANTS` maps over an `AnyStatus` union. Card statuses get added to those maps; a second badge component would be a duplicate.
- `src/app/siteConfig.ts` and `src/components/ui/navigation/AppSidebar.tsx` — `baseLinks` and the sidebar `navigation` array. **Neither knows about `/cards`,** so the route is unreachable until both are updated.
- `vitest.config.ts` — `environment: "node"`, `include: ["src/**/*.test.ts"]`. **No jsdom**, so tests cover pure logic only. Existing suites: `src/lib/money.test.ts`, `dates.test.ts`, `csv.test.ts`.

**Pre-existing defect found while reading, in scope because the card list will sort:** `sortPayments` in `src/data/queries.ts` compares amounts as text — `String(a.amount).localeCompare(String(b.amount))` — so a 900 amount sorts after a 1000 one. The comment above it claims the order matches the formatted display, which is the reasoning that introduced it.

## Domain rules

| Rule | Source | What breaks if ignored |
| --- | --- | --- |
| "Money is integer minor units. `$250.00` is `25000`." | `merchant-console/CLAUDE.md` | Cents drift; a limit of `25000.0000001` compares wrong |
| "Format once, at the edge, next to its currency code." | `.claude/rules/money.md` | Two halves of the app disagree about the same number |
| "Generated numbers use the `4242` test BIN and a valid Luhn check digit." | `.claude/rules/cards.md` | Something in the repo resembles a real PAN |
| "Generate on the server. A card number produced in the browser is a bug." | `.claude/rules/cards.md` | The PAN is mintable by anyone with devtools |
| "The full number appears in the creation response and nowhere else: not on the card record, not in a list or detail payload, not left in client state after the success screen closes." | `.claude/rules/cards.md` | A PAN is recoverable after issue |
| "Status is a state machine: `active ⇄ frozen`, either to `cancelled`, and `cancelled` is terminal. Guard the transition on the server, not only in the UI." | `merchant-console/CLAUDE.md` | A cancelled card comes back to life |
| "Validate on the server. Anything from the client is checked against an allowlist." | `merchant-console/CLAUDE.md` | The client is the enforcement point, which is no enforcement |
| "Every amount travels with its currency code." | `.claude/rules/money.md` | A GBP limit renders as dollars |
| "Card numbers are masked everywhere except the single creation response." | `docs/ORG-STANDARDS.md` #8 | Reportable data handling failure |

## Approach

Cards get their own vertical slice that mirrors the payments slice exactly: types in `src/data/types.ts`, pure logic in `src/lib/cards.ts` with its test beside it, store access in `src/data/cards.ts`, two route handlers under `src/app/api/cards/`, and server-component pages under `src/app/cards/`. The reveal-once guarantee is enforced **by the type**: `Card` has no field that can hold a full number, only `last4` and an opaque `reference`, so the PAN physically cannot be persisted or serialised by a list or detail render. It exists as a local variable in the POST handler and in that one response body. Server-side validation lives in the route handler as a flat sequence of reject-early checks, in the same allowlist spirit as `parseFilters`.

**Considered and rejected:** a `GET /api/cards` route feeding the list page by `fetch`. Rejected because `src/app/payments/page.tsx` reads `queryPayments()` directly in the server component and `.claude/rules/components.md` says to keep data fetching out of components "where a route handler already returns what you need" — adding a read route nobody consumes would be dead surface and a larger diff. Writes go through route handlers because they need validation and a status code; reads go straight to the store like their payment equivalents.

**Also rejected:** deriving `reference` from the PAN (a hash or a truncation). It would make the reference a partial leak of the number it is standing in for. It is an independent opaque handle.

## Interface contract

Three builders work in parallel against this. These signatures are fixed; a builder that needs to change one stops and says so rather than improvising.

**`src/data/types.ts`** — added, not modified:

```
CardStatus   = "active" | "frozen" | "cancelled"
CardCategory = "advertising" | "software" | "travel" | "contractors" | "utilities"

CardEvent { from: CardStatus | null; to: CardStatus; at: string; actor: string }
  from === null means the issue event. actor is "ops" — there is no auth in scope.

Card {
  id: string            // `crd_` + 8 lowercase hex, matching the mch_/pay_ prefix convention
  nickname: string
  merchantId: string
  last4: string         // 4 digits — always "4242" for generated numbers, stored not derived
  reference: string     // `cref_` + 12 hex. Opaque handle. NOT derived from the PAN
  spendLimit: number    // integer minor units
  spent: number         // integer minor units
  currency: Currency
  category: CardCategory
  status: CardStatus
  createdAt: string     // ISO 8601 UTC
  events: CardEvent[]
}
```

There is deliberately **no `number` field on `Card`**.

**`src/lib/cards.ts`** — pure, no store import, node-testable:

```
CARD_BIN = "4242"
CARD_NUMBER_LENGTH = 16
MAX_SPEND_LIMIT_MINOR_UNITS = 5_000_000
CARD_CATEGORIES: readonly CardCategory[]
CARD_CURRENCIES: readonly Currency[]          // the server-side allowlist
NEAR_LIMIT_PERCENT = 80

luhnCheckDigit(digitsWithoutCheck: string): number
isValidLuhn(cardNumber: string): boolean
generateCardNumber(): string                   // CARD_BIN + 11 random digits + check digit
maskCardNumber(last4: string): string          // "•••• 4242"
CARD_TRANSITIONS: Record<CardStatus, readonly CardStatus[]>
  active: ["frozen", "cancelled"], frozen: ["active", "cancelled"], cancelled: []
canTransition(from: CardStatus, to: CardStatus): boolean
isNearLimit(spent: number, spendLimit: number): boolean
  integer math only: spent * 100 >= spendLimit * NEAR_LIMIT_PERCENT
```

**`src/data/cards.ts`** — store access, mirroring `src/data/queries.ts`:

```
listCards(): Card[]                            // newest first, by createdAt
cardById(id: string): Card | null
createCard(input: { nickname; merchantId; spendLimit; currency; category }): { card: Card; number: string }
  generates the number, stores last4 + reference, appends the issue event, returns the PAN once
transitionCard(id: string, to: CardStatus): Card | null   // returns null when the card is missing
cardForIdempotencyKey(key: string): Card | null
recordIdempotencyKey(key: string, cardId: string): void
```

**`POST /api/cards`** — body `{ nickname, merchantId, spendLimit, currency, category }`, `spendLimit` already in minor units; optional `Idempotency-Key` header.

Reject early, each with `{ message }` and a status that means it:
- unknown or missing `merchantId` → 400
- `nickname` empty after trim → 400
- `spendLimit` not an integer, `<= 0`, or `> 5_000_000` → 400
- `currency` outside `CARD_CURRENCIES` → 400
- `currency` !== the merchant's own currency → 400
- `category` outside `CARD_CATEGORIES` → 400

On success `201 { card, number }`. On a repeated `Idempotency-Key` → `200 { card }` for the original card, **no `number`**, no second card minted.

**`PATCH /api/cards/[id]`** — body `{ status }`. Unknown card → 404. `status` outside `CardStatus` → 400. Illegal transition (anything out of `cancelled`, or a no-op) → **409** `{ message }`. On success `200 { card }`.

## File map

| File | Add or change | Why | Owner |
| --- | --- | --- | --- |
| `src/data/types.ts` | change | `Card`, `CardStatus`, `CardCategory`, `CardEvent`. No `number` field | A |
| `src/data/store.ts` | change | `cards: Card[]` and `cardIdempotencyKeys: Map<string, string>` on `Store`; `??=` guard so a hot-reloaded store gains the new shape | A |
| `src/lib/cards.ts` | add | Luhn, BIN, masking, transition table, limit constants, 80% threshold | A |
| `src/lib/cards.test.ts` | add | Luhn and transitions, beside the code they cover | A |
| `src/data/cards.ts` | add | Store access and the idempotency ledger, mirroring `queries.ts` | A |
| `src/app/api/cards/route.ts` | add | `POST` with all server-side validation and the one-time reveal | A |
| `src/app/api/cards/[id]/route.ts` | add | `PATCH`, guarded by `canTransition` | A |
| `src/data/queries.ts` | change | Fix `sortPayments` comparing amounts as text | B |
| `src/data/queries.test.ts` | add | Proves the numeric sort; fails against the current code | B |
| `src/app/siteConfig.ts` | change | `baseLinks.cards` | B |
| `src/components/ui/navigation/AppSidebar.tsx` | change | Cards nav entry, `Wallet` icon | B |
| `src/components/ui/payments/StatusBadge.tsx` | change | Card statuses added to the existing maps | B |
| `src/app/cards/page.tsx` | add | The `/cards` list, written empty state, issue trigger | C |
| `src/app/cards/issue-card-drawer.tsx` | add | Client form, currency derived from merchant, one-time reveal, idempotency key | C |
| `src/app/cards/card-actions.tsx` | add | Freeze/unfreeze without a reload; cancel behind a confirm | C |
| `src/app/cards/[id]/page.tsx` | add | Detail, spend progress, audit trail | C |

## Plan

1. **Types, store, pure logic and its test** — done when: `npm test` passes with new cases proving `generateCardNumber()` starts `4242`, is 16 digits, satisfies `isValidLuhn` across 200 draws, and that `cancelled` transitions nowhere.
2. **Both route handlers** — done when: `curl -X POST /api/cards` with a valid body returns 201 with a `number`; a GBP currency against `mch_01` (USD) returns 400; `spendLimit: 5000001` returns 400; the same `Idempotency-Key` twice returns one card and no second `number`; `PATCH` from `cancelled` returns 409.
3. **Nav, badge, and the sort fix** — done when: `/cards` appears in the sidebar and `queries.test.ts` fails on `main` and passes here.
4. **List and issue flow** — done when: submitting the drawer shows the full number once on the success screen, closing it drops the number from state, and the row appears masked as `•••• 4242`.
5. **Detail, progress, audit trail, actions** — done when: the bar turns amber past 80%, freeze then unfreeze updates the row without a page reload, and cancel requires a confirm and then renders a terminal state with no way back.
6. **`/ship-ready`, then push** — done when: checks are clean and the PR body carries the real `npm test` summary line.

## Verification

| Acceptance criterion | How it is proven |
| --- | --- |
| Issue a card | Drawer submits → 201 → row present in `/cards` |
| Card list | `/cards` renders nickname, merchant, `•••• 4242`, `formatMoney(spendLimit, currency)`, `StatusBadge`, `formatDate(createdAt)` |
| Card detail | `/cards/[id]` renders the full record plus `spent` against `spendLimit` |
| Generated numbers | `src/lib/cards.test.ts` — 200 generated numbers, all `4242`-prefixed, 16 digits, Luhn-valid; a tampered digit fails |
| Reveal once | `Card` has no number field (type-level); success screen shows it, close clears it; no read route or page payload contains it |
| Server-side validation | `curl` each rejection case against `POST /api/cards` and paste the status + message |
| State machine | `src/lib/cards.test.ts` on `CARD_TRANSITIONS`; `PATCH` out of `cancelled` returns 409 |
| Minor units | `spendLimit`/`spent` are `number` integers end to end; `parseAmountToMinorUnits` at the form boundary, `formatMoney` at render, nothing between |
| Spend progress amber past 80% | `isNearLimit` unit cases at 79%, exactly 80%, 81% |
| Idempotent issue | Two POSTs with one `Idempotency-Key`; `listCards()` length unchanged |
| Currency matches merchant | Form derives it from the selected merchant **and** the route rejects a mismatch with 400 |
| Sort bug fixed | `src/data/queries.test.ts` orders 900 before 1000 ascending |

## Risks

- **The store is cached on `globalThis`.** A dev server that was running before `cards` was added keeps the old object and `store.cards` is `undefined`. Guard with `??=` in `store.ts` rather than relying on a restart.
- **Three builders in parallel** against a fixed contract. File ownership in the file map is strict; a builder that wants to edit a file it does not own stops and reports instead.
- **`Drawer` is not `Dialog`.** The rules file names a component that does not exist; using `Drawer` is the accessible path that already works.
- **`spent` must not be invented.** It is `0` at issue and stays `0`, and the progress bar renders that truthfully. Fabricating spend to make the amber state visible would be a false record; the 80% threshold is proven by unit test instead.

## Out of scope

- Persistence, any database, ORM or migration — NWP-203, and explicitly a quality failure here.
- Authentication, roles and permissions. `CardEvent.actor` is the literal `"ops"`.
- Real card network calls. There is no issuer.
- Editing a spend limit after issue — NWP-202.
- The float accumulation, local-date bucketing and refunds-in-gross defects in `src/data/metrics.ts`. Real, but on the overview path, not the cards path; noted here rather than fixed to keep this diff reviewable.

## Open questions

- None blocking. Card categories are not enumerated anywhere in the repo, so the five in the contract are chosen to match the ticket's stated use — "vendor subscriptions, ad spend, and contractor tools".
