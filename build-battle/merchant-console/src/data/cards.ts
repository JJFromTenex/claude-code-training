import { generateCardNumber } from "@/lib/cards"
import { store } from "./store"
import { Card, CardCategory, CardStatus, Currency } from "./types"

/**
 * Card lookups and writes against the in-memory store.
 *
 * Mirrors the shape of queries.ts: route handlers call these rather than
 * reaching into the store themselves.
 */

export function allCards(): Card[] {
  return [...store.cards].sort((a, b) => b.createdAt.localeCompare(a.createdAt))
}

export function cardById(id: string): Card | null {
  return store.cards.find((card) => card.id === id) ?? null
}

export interface NewCard {
  nickname: string
  merchantId: string
  spendLimit: number
  currency: Currency
  category: CardCategory
}

/**
 * Issues a card and returns the number alongside it.
 *
 * The number is deliberately not part of the stored record: this is the only
 * moment it exists, and the caller is responsible for handing it to the one
 * response that is allowed to carry it.
 */
export function createCard(input: NewCard, now = new Date()): {
  card: Card
  number: string
} {
  const number = generateCardNumber()
  const sequence = store.cards.length + 1

  const card: Card = {
    id: `card_${String(sequence).padStart(6, "0")}`,
    nickname: input.nickname,
    merchantId: input.merchantId,
    last4: number.slice(-4),
    reference: `cref_${String(sequence).padStart(8, "0")}`,
    spendLimit: input.spendLimit,
    spend: 0,
    currency: input.currency,
    category: input.category,
    status: "active",
    createdAt: now.toISOString(),
  }

  store.cards.push(card)
  return { card, number }
}

/** Applies an already-validated transition. Guarding it is the caller's job. */
export function updateCardStatus(id: string, status: CardStatus): Card | null {
  const card = cardById(id)
  if (!card) return null
  card.status = status
  return card
}
