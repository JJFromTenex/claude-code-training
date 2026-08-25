import { generateCardNumber } from "@/lib/cardNumber"
import { store } from "./store"
import { Card, CardCategory, CardStatus, Currency } from "./types"

/**
 * The card read and write surface. Cards need no filtering or pagination in
 * NWP-201, so they do not go through the payment query builder in
 * `queries.ts` — that builder is typed to Payment and exists to stop a second
 * payment filter path, not to serve every collection.
 */

export const CARD_CURRENCIES: readonly Currency[] = ["USD", "EUR", "GBP"]

export const CARD_CATEGORIES: readonly CardCategory[] = [
  "software",
  "advertising",
  "contractor",
  "travel",
  "other",
]

export const CARD_STATUSES: readonly CardStatus[] = [
  "active",
  "frozen",
  "cancelled",
]

/** Integer minor units. A limit above this is rejected at the boundary. */
export const MAX_SPEND_LIMIT = 5_000_000

/**
 * `active ⇄ frozen`, either to `cancelled`, and `cancelled` is terminal.
 * This table is the only description of the state machine in the codebase;
 * the UI reads it rather than restating it.
 */
export const ALLOWED_TRANSITIONS: Record<CardStatus, readonly CardStatus[]> = {
  active: ["frozen", "cancelled"],
  frozen: ["active", "cancelled"],
  cancelled: [],
}

export function canTransition(from: CardStatus, to: CardStatus): boolean {
  return ALLOWED_TRANSITIONS[from].includes(to)
}

export function allCards(): Card[] {
  return [...store.cards].sort((a, b) => b.createdAt.localeCompare(a.createdAt))
}

export function cardById(id: string): Card | null {
  return store.cards.find((card) => card.id === id) ?? null
}

export interface NewCardInput {
  nickname: string
  merchantId: string
  spendLimit: number
  currency: Currency
  category: CardCategory
}

function nextCardId(): string {
  const highest = store.cards.reduce((max, card) => {
    const n = Number(card.id.replace("card_", ""))
    return Number.isFinite(n) && n > max ? n : max
  }, 0)
  return `card_${String(highest + 1).padStart(6, "0")}`
}

/**
 * Creates the card and hands back the full number **separately** from the
 * record. `Card` has no field to hold one, so the number reaches the creation
 * response and stops there.
 */
export function addCard(input: NewCardInput): { card: Card; fullNumber: string } {
  const { full, last4 } = generateCardNumber()

  const card: Card = {
    id: nextCardId(),
    nickname: input.nickname,
    merchantId: input.merchantId,
    spendLimit: input.spendLimit,
    spent: 0,
    currency: input.currency,
    status: "active",
    category: input.category,
    last4,
    createdAt: new Date().toISOString(),
  }

  store.cards.push(card)
  return { card, fullNumber: full }
}

export type TransitionResult =
  | { ok: true; card: Card }
  | { ok: false; status: number; error: string }

/**
 * The one guard on card status. Route handlers report its result; they never
 * decide legality themselves, and neither does the UI.
 */
export function setCardStatus(id: string, next: CardStatus): TransitionResult {
  const card = cardById(id)
  if (!card) return { ok: false, status: 404, error: "Card not found." }

  if (card.status === next) {
    return { ok: false, status: 409, error: `Card is already ${next}.` }
  }

  if (!canTransition(card.status, next)) {
    return {
      ok: false,
      status: 409,
      error:
        card.status === "cancelled"
          ? "A cancelled card is permanent and cannot be changed."
          : `Cannot move a ${card.status} card to ${next}.`,
    }
  }

  card.status = next
  return { ok: true, card }
}
