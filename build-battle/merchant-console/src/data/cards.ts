import { generateTestCardNumber } from "@/lib/cardNumber"
import { randomUUID } from "node:crypto"
import { canTransition, IssueCardInput } from "./cardRules"
import { store } from "./store"
import { Card, CardStatus } from "./types"

/**
 * Card operations against the in-memory store. Server-only: this is where
 * numbers are generated, and the full number never leaves `issueCard` except
 * in its return value, which the creation route sends exactly once.
 */

export function listCards(): Card[] {
  return [...store.cards].sort((a, b) => b.createdAt.localeCompare(a.createdAt))
}

export function cardById(id: string): Card | null {
  return store.cards.find((card) => card.id === id) ?? null
}

export type IssueCardResult =
  | { status: "issued"; card: Card; number: string }
  | { status: "duplicate"; cardId: string }

export function issueCard(
  input: IssueCardInput,
  idempotencyKey: string,
): IssueCardResult {
  const existing = store.cardIssueKeys.get(idempotencyKey)
  if (existing) return { status: "duplicate", cardId: existing }

  const number = generateTestCardNumber()
  const createdAt = new Date().toISOString()
  const card: Card = {
    id: `card_${String(store.cards.length + 1).padStart(4, "0")}`,
    ...input,
    spent: 0,
    last4: number.slice(-4),
    numberRef: `tok_${randomUUID()}`,
    status: "active",
    createdAt,
    history: [{ at: createdAt, from: null, to: "active" }],
  }

  store.cards.push(card)
  store.cardIssueKeys.set(idempotencyKey, card.id)
  return { status: "issued", card, number }
}

export type ChangeStatusResult =
  | { status: "ok"; card: Card }
  | { status: "not_found" }
  | { status: "invalid_transition"; from: CardStatus }

/** The server-side guard on the state machine. The UI only mirrors it. */
export function changeCardStatus(id: string, to: CardStatus): ChangeStatusResult {
  const card = cardById(id)
  if (!card) return { status: "not_found" }
  if (!canTransition(card.status, to)) {
    return { status: "invalid_transition", from: card.status }
  }

  card.history.push({ at: new Date().toISOString(), from: card.status, to })
  card.status = to
  return { status: "ok", card }
}
