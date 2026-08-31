import { canTransition, generateCardNumber } from "@/lib/cards"
import { store } from "./store"
import { Card, CardCategory, CardStatus, Currency } from "./types"

/**
 * The one place src/data/store.ts's cards array is read or written.
 * Route handlers call these rather than touching the store directly.
 */

function pad(n: number, width = 6): string {
  return String(n).padStart(width, "0")
}

export function listCards(): Card[] {
  return store.cards
}

export function cardById(id: string): Card | null {
  return store.cards.find((c) => c.id === id) ?? null
}

export interface CreateCardInput {
  nickname: string
  merchantId: string
  limit: number
  currency: Currency
  category?: CardCategory
}

/**
 * Generates the number server-side, stores only the last four, and returns
 * the full number exactly once. Nothing after this call can read it back.
 */
export function createCard(input: CreateCardInput): { card: Card; number: string } {
  const number = generateCardNumber()
  const last4 = number.slice(-4)

  const card: Card = {
    id: `card_${pad(store.cards.length + 1)}`,
    nickname: input.nickname,
    merchantId: input.merchantId,
    limit: input.limit,
    currency: input.currency,
    status: "active",
    spent: 0,
    last4,
    category: input.category,
    createdAt: new Date().toISOString(),
  }

  store.cards.push(card)
  return { card, number }
}

/** Returns the updated card, or null if the transition isn't legal. */
export function updateCardStatus(id: string, next: CardStatus): Card | null {
  const card = cardById(id)
  if (!card) return null
  if (!canTransition(card.status, next)) return null
  card.status = next
  return card
}
