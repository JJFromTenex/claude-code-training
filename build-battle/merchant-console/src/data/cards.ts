import { generateCardNumber } from "@/lib/cards"
import { store } from "./store"
import { Card, CardCategory, CardStatus, Currency } from "./types"

/**
 * Store access for cards, mirroring the shape of queries.ts. Validation
 * lives in the route handlers, not here — this file only reads and writes
 * the store.
 */

function randomHex(length: number): string {
  let hex = ""
  for (let i = 0; i < length; i++) {
    hex += Math.floor(Math.random() * 16).toString(16)
  }
  return hex
}

export function listCards(): Card[] {
  return [...store.cards].sort((a, b) => b.createdAt.localeCompare(a.createdAt))
}

export function cardById(id: string): Card | null {
  return store.cards.find((card) => card.id === id) ?? null
}

export function createCard(input: {
  nickname: string
  merchantId: string
  spendLimit: number
  currency: Currency
  category: CardCategory
}): { card: Card; number: string } {
  const number = generateCardNumber()
  const now = new Date().toISOString()

  const card: Card = {
    id: `crd_${randomHex(8)}`,
    nickname: input.nickname,
    merchantId: input.merchantId,
    // The generated number's true trailing digits, so two cards can be told
    // apart in a list. The 4242 test BIN is the number's prefix, which the
    // full number carries and no stored record does.
    last4: number.slice(-4),
    reference: `cref_${randomHex(12)}`,
    spendLimit: input.spendLimit,
    spent: 0,
    currency: input.currency,
    category: input.category,
    status: "active",
    createdAt: now,
    events: [{ from: null, to: "active", at: now, actor: "ops" }],
  }

  store.cards.push(card)
  return { card, number }
}

export function transitionCard(id: string, to: CardStatus): Card | null {
  const card = cardById(id)
  if (!card) return null

  card.events.push({
    from: card.status,
    to,
    at: new Date().toISOString(),
    actor: "ops",
  })
  card.status = to
  return card
}

export function cardForIdempotencyKey(key: string): Card | null {
  const cardId = store.cardIdempotencyKeys.get(key)
  if (!cardId) return null
  return cardById(cardId)
}

export function recordIdempotencyKey(key: string, cardId: string): void {
  store.cardIdempotencyKeys.set(key, cardId)
}
