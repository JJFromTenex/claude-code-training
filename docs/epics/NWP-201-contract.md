# CONTRACT · NWP-201 — Issue virtual cards

> Frozen interface for the parallel build. Written with `/lanes` from
> [the epic](NWP-201-issue-cards.md), before any lane was dispatched.
>
> **Every signature below is frozen.** A lane implements what is here. If something
> is wrong or missing, the lanes stop — they do not each invent a repair.

## Foundation — landed before dispatch, owned by the integrator

These files are shared by more than one lane, so no lane owns them. They compile clean before anything is dispatched.

`src/data/types.ts` — appended to the existing exports:

```ts
export type CardStatus = "active" | "frozen" | "cancelled"

export type MerchantCategory =
  | "advertising"
  | "software"
  | "travel"
  | "contractors"
  | "utilities"

export interface Card {
  id: string                      // "crd_01"
  nickname: string
  merchantId: string
  /** Integer minor units. Never a float. */
  spendLimit: number
  /** Integer minor units, same currency as spendLimit. */
  spent: number
  currency: Currency
  status: CardStatus
  category: MerchantCategory | null
  brand: "visa"
  /** Last four digits only. The full number is never stored. */
  last4: string
  /** Issuer reference for the generated number. Not the number. */
  reference: string               // "cref_..."
  /** ISO 8601, always UTC. */
  createdAt: string
}

export interface CardInput {
  nickname: string
  merchantId: string
  spendLimit: number              // minor units, already converted
  currency: Currency
  category: MerchantCategory | null
}
```

- `src/data/store.ts` — `cards: Card[]` added to `Store` and to `createStore()`.
- `src/data/generate.ts` — seeds ~6 cards: mixed statuses, at least one `cancelled`, at least one past 80% of its limit, spanning USD/EUR/GBP. Additive only.
- `src/components/ui/payments/StatusBadge.tsx` — `CardStatus` added to the `AnyStatus` union with entries in `LABELS`, `DOTS`, `VARIANTS`: `active` → success, `frozen` → default, `cancelled` → neutral.
- `src/app/siteConfig.ts` — `cards: "/cards"` in `baseLinks`.
- `src/components/ui/navigation/AppSidebar.tsx` — Cards nav item, `CreditCard` icon is taken by Payments so use `Wallet` from `lucide-react`.

## `src/lib/cards.ts` — Lane 1

Pure. No store access, no imports from `src/data/` except types.

```ts
/** The only BIN in this repository. Nothing here may resemble a real PAN. */
export const TEST_BIN = "4242"

/** Total length of a generated number, including the check digit. */
export const CARD_NUMBER_LENGTH = 16

/** True if `number` (digits only) carries a valid Luhn check digit. */
export function luhnCheck(number: string): boolean

/** The check digit that makes `partial` (15 digits) Luhn-valid. */
export function luhnCheckDigit(partial: string): string

/**
 * A 16-digit number: TEST_BIN, then 11 random digits, then the Luhn check
 * digit. Server-only — calling this in the browser is a bug.
 */
export function generateCardNumber(): string

/** "•••• 4242" from a four-digit string. The only masking in the app. */
export function maskLast4(last4: string): string

/**
 * The state machine: active ⇄ frozen, either to cancelled, cancelled terminal.
 * A transition to the same status is false.
 */
export function canTransition(from: CardStatus, to: CardStatus): boolean
```

**Limits, frozen here so every lane rejects the same things:**

```ts
export const MIN_SPEND_LIMIT = 1          // minor units, exclusive of 0
export const MAX_SPEND_LIMIT = 5_000_000  // minor units, inclusive
export const CARD_CURRENCIES: readonly Currency[] = ["USD", "EUR", "GBP"]
```

## `src/data/cards.ts` — Lane 1

Modelled on `src/data/queries.ts`. Holds the allowlist and the store access.

```ts
export function listCards(): Card[]              // newest createdAt first
export function cardById(id: string): Card | undefined

/**
 * The allowlist. Everything from the client goes through here before it
 * reaches the store. `spendLimit` may arrive as a string like "250.00" and is
 * converted once, by parseAmountToMinorUnits() from src/lib/money.ts.
 */
export function parseCardInput(
  body: unknown,
): { ok: true; value: CardInput } | { ok: false; message: string }

/**
 * Generates the number, stores last4 + reference, returns the full number to
 * the caller exactly once. `fullNumber` is never written to the store.
 */
export function createCard(input: CardInput): { card: Card; fullNumber: string }

export function setCardStatus(
  id: string,
  next: CardStatus,
): { ok: true; card: Card } | { ok: false; status: 404 | 409; message: string }
```

**Rejection messages** — these strings are what the UI shows, so they are fixed here:

| Condition | Message |
| --- | --- |
| Missing or unknown `merchantId` | `Choose a merchant.` |
| `nickname` empty after trim | `Give the card a nickname.` |
| `spendLimit` unparseable | `Enter a limit like 250 or 250.00.` |
| `spendLimit <= 0` | `The spend limit must be more than zero.` |
| `spendLimit > 5_000_000` | `The spend limit cannot exceed 50,000.00.` |
| `currency` outside the allowlist | `Currency must be USD, EUR, or GBP.` |
| `category` present but unknown | `Choose a valid category.` |
| `setCardStatus` id not found | `No card with that id.` |
| Transition not allowed | `A cancelled card cannot change status.` / `That card is already <status>.` |

## Routes — Lane 1

Error body is `{ message: string }` on every non-2xx, everywhere.

| Method | Path | Body in | Success | Failures |
| --- | --- | --- | --- | --- |
| `GET` | `/api/cards` | — | `200 { rows: Card[], total: number }` | — |
| `POST` | `/api/cards` | `{ nickname, merchantId, spendLimit, currency, category }` | `201 { card: Card, fullNumber: string }` | `400 { message }` |
| `GET` | `/api/cards/[id]` | — | `200 { card: Card }` | `404 { message }` |
| `PATCH` | `/api/cards/[id]/status` | `{ status: CardStatus }` | `200 { card: Card }` | `400` unknown status · `404` no card · `409` illegal transition |

**`fullNumber` appears in exactly one place in this table.** Any lane that finds it elsewhere has found a bug.

## Lane ownership

Every file appears exactly once. Edit nothing outside your row.

| Lane | Agent | Owns | Depends on |
| --- | --- | --- | --- |
| 1 · Server | `route-builder` | `src/lib/cards.ts`, `src/data/cards.ts`, `src/app/api/cards/route.ts`, `src/app/api/cards/[id]/route.ts`, `src/app/api/cards/[id]/status/route.ts` | Foundation |
| 2 · Tests | `test-writer` | `src/lib/cards.test.ts` | Contract only — written against the signatures above, red until Lane 1 lands |
| 3 · Pages | `ui-builder` | `src/app/cards/page.tsx`, `src/app/cards/[id]/page.tsx` | Foundation + the `Card` type. Reads `listCards()` / `cardById()` directly, server-side |
| 4 · Islands | `ui-builder` | `src/app/cards/issue-card-form.tsx`, `src/app/cards/card-actions.tsx` | The route table above |

Lanes 1–4 run concurrently. Lane 3 imports two functions Lane 1 is writing; that is a dependency on a *signature*, which the contract covers, not on a file.

## Integration checklist — the integrator, after the lanes report

- [ ] `npx tsc --noEmit` clean across the app
- [ ] `npm test` green
- [ ] `curl -s localhost:3000/api/cards | grep -E '[0-9]{16}'` returns nothing
- [ ] `curl -s -X POST localhost:3000/api/cards -H 'content-type: application/json' -d '…'` returns a 16-digit `fullNumber`
- [ ] All four rejections return `400` with the message from the table above
- [ ] `PATCH` on a cancelled card returns `409`
- [ ] Read the whole diff as one change — collapse anything two lanes solved twice
- [ ] Issue a card in the browser, close the success drawer, reopen it: no number
- [ ] `/ship-ready`
