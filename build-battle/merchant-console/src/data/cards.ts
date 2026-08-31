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

function cardByIdempotencyKey(key: string): Card | null {
  return store.cards.find((c) => c.idempotencyKey === key) ?? null
}

export interface CreateCardInput {
  nickname: string
  merchantId: string
  limit: number
  currency: Currency
  category?: CardCategory
  /** A client-supplied key deduping a retried issue request. Optional. */
  idempotencyKey?: string
}

/**
 * Generates the number server-side, stores only the last four, and returns
 * the full number exactly once. Nothing after this call can read it back.
 *
 * Retrying the same idempotencyKey (a double-click, a client retry after a
 * dropped response) does not mint a second card — it returns the existing
 * one instead, with `number: null` and `duplicate: true`, since the number
 * was already revealed once and reveal-once means once.
 */
export function createCard(
  input: CreateCardInput,
): { card: Card; number: string | null; duplicate: boolean } {
  if (input.idempotencyKey) {
    const existing = cardByIdempotencyKey(input.idempotencyKey)
    if (existing) return { card: existing, number: null, duplicate: true }
  }

  const number = generateCardNumber()
  const last4 = number.slice(-4)
  const createdAt = new Date().toISOString()

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
    history: [{ status: "active", at: createdAt }],
    idempotencyKey: input.idempotencyKey,
    createdAt,
  }

  store.cards.push(card)
  return { card, number, duplicate: false }
}

/** Returns the updated card, or null if the transition isn't legal. */
export function updateCardStatus(id: string, next: CardStatus): Card | null {
  const card = cardById(id)
  if (!card) return null
  if (!canTransition(card.status, next)) return null
  card.status = next
  card.history.push({ status: next, at: new Date().toISOString() })
  return card
}
