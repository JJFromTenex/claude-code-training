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

export function merchantIds(): string[] {
  return store.merchants.map((merchant) => merchant.id)
}
