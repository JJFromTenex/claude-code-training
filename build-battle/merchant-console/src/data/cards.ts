import { store } from "./store"
import { Card, Currency } from "./types"

/**
 * Card reads and writes against the in-memory store. Pages and route handlers
 * import from here rather than reaching for `store` directly.
 */

/** Newest first. */
export function listCards(): Card[] {
  return [...store.cards].sort((a, b) => b.createdAt.localeCompare(a.createdAt))
}

export function cardById(id: string): Card | null {
  return store.cards.find((card) => card.id === id) ?? null
}

/**
 * Takes already-validated fields and the last four of a number generated
 * elsewhere. The full number is never passed in and never stored.
 *
 * Pushes onto `store.cards`. Reassigning `store` instead would appear to work
 * and then lose every write on the next dev-server reload.
 */
export function createCard(input: {
  nickname: string
  merchantId: string
  last4: string
  spendLimit: number
  currency: Currency
}): Card {
  const card: Card = {
    id: `card_${String(store.cards.length + 1).padStart(4, "0")}`,
    nickname: input.nickname,
    merchantId: input.merchantId,
    last4: input.last4,
    spendLimit: input.spendLimit,
    spend: 0,
    currency: input.currency,
    status: "active",
    createdAt: new Date().toISOString(),
  }
  store.cards.push(card)
  return card
}
