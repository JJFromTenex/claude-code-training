import { CardAction, generateCardNumber, nextStatus } from "@/lib/cards"
import { store } from "./store"
import { Card, Currency } from "./types"

/** Card store accessors. Route handlers and pages go through these. */

export function listCards(): Card[] {
  return [...store.cards].sort((a, b) => b.createdAt.localeCompare(a.createdAt))
}

export function cardById(id: string): Card | undefined {
  return store.cards.find((card) => card.id === id)
}

export interface IssueCardInput {
  merchantId: string
  nickname: string
  /** Integer minor units, already validated at the API boundary. */
  spendLimit: number
  currency: Currency
  categoryLock: string | null
}

/**
 * Generates the number server-side and returns the full PAN exactly once.
 * The store keeps the last four and an opaque reference; nothing here can
 * be read back into a full number.
 */
export function issueCard(input: IssueCardInput): {
  card: Card
  fullNumber: string
} {
  const fullNumber = generateCardNumber()
  const createdAt = new Date().toISOString()
  const card: Card = {
    id: `card_${String(store.cards.length + 1).padStart(4, "0")}`,
    merchantId: input.merchantId,
    nickname: input.nickname,
    last4: fullNumber.slice(-4),
    numberRef: `ref_${crypto.randomUUID()}`,
    spendLimit: input.spendLimit,
    spent: 0,
    currency: input.currency,
    status: "active",
    categoryLock: input.categoryLock,
    createdAt,
    history: [{ at: createdAt, label: "Card issued" }],
  }
  store.cards.push(card)
  return { card, fullNumber }
}

const ACTION_LABELS: Record<CardAction, string> = {
  freeze: "Frozen",
  unfreeze: "Unfrozen",
  cancel: "Cancelled",
}

/**
 * Applies a status action through the state machine. Returns null when the
 * transition is illegal — cancelled is terminal, and the caller decides
 * what status code that deserves.
 */
export function transitionCard(id: string, action: CardAction): Card | null {
  const card = cardById(id)
  if (!card) return null
  const status = nextStatus(card.status, action)
  if (!status) return null
  card.status = status
  card.history.push({
    at: new Date().toISOString(),
    label: ACTION_LABELS[action],
  })
  return card
}
