import { store } from "./store"
import { Card } from "./types"

/**
 * Card reads and the one write path.
 *
 * Kept beside the store rather than in a route so the list page, the detail
 * page, and the route handlers all go through the same functions.
 */

/** Newest first, the order ops expects in the list. */
export function allCards(): Card[] {
  return [...store.cards].sort((a, b) => b.createdAt.localeCompare(a.createdAt))
}

export function cardById(id: string): Card | undefined {
  return store.cards.find((card) => card.id === id)
}

export function addCard(card: Card): Card {
  store.cards.push(card)
  return card
}

/** Next id in sequence, so ids stay readable after cards are issued. */
export function nextCardId(): string {
  return `card_${String(store.cards.length + 1).padStart(4, "0")}`
}

export function issuingMerchants(): { id: string; currency: Card["currency"] }[] {
  return store.merchants.map((merchant) => ({
    id: merchant.id,
    currency: merchant.currency,
  }))
}

/**
 * Idempotency keys seen so far, mapped to the card they created.
 *
 * A double-submit — an impatient second click, a retried request — must not
 * issue two cards with two different numbers against one intent. Lives on the
 * store so it shares the in-memory lifetime of everything else.
 */
const issuedKeys = new Map<string, string>()

export function cardForIdempotencyKey(key: string): Card | undefined {
  const id = issuedKeys.get(key)
  return id ? cardById(id) : undefined
}

export function rememberIdempotencyKey(key: string, cardId: string): void {
  issuedKeys.set(key, cardId)
}
