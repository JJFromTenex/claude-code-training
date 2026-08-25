import { generateCardNumber } from "@/lib/cards"
import { store } from "./store"
import { Card, CardCategory, CardStatus, Currency } from "./types"

/**
 * Cards: allowlists, the status state machine, and the store operations. The
 * state machine is pure, so the route handler and the tests ask one question.
 */

/** Categories a card may be locked to. Anything else is rejected on the server. */
export const CARD_CATEGORIES: readonly CardCategory[] = [
  "advertising",
  "software",
  "travel",
  "contractors",
  "shipping",
  "other",
]

export const CARD_CATEGORY_LABELS: Record<CardCategory, string> = {
  advertising: "Advertising",
  software: "Software",
  travel: "Travel",
  contractors: "Contractors",
  shipping: "Shipping",
  other: "Other",
}

/** Integer minor units. The ceiling ops may issue without platform sign-off. */
export const CARD_LIMIT_MAX_MINOR_UNITS = 5_000_000

/** `active ⇄ frozen`, either to `cancelled`, and `cancelled` is terminal. */
const TRANSITIONS: Record<CardStatus, readonly CardStatus[]> = {
  active: ["frozen", "cancelled"],
  frozen: ["active", "cancelled"],
  cancelled: [],
}

export function canTransition(from: CardStatus, to: CardStatus): boolean {
  return TRANSITIONS[from].includes(to)
}

/** The card after a legal transition, or null. New record, so a refusal cannot half-apply. */
export function applyTransition(
  card: Card,
  to: CardStatus,
  at: string,
): Card | null {
  if (!canTransition(card.status, to)) return null
  return {
    ...card,
    status: to,
    statusHistory: [...card.statusHistory, { status: to, at }],
  }
}

/** Newest first, the order ops reads them in. */
export function listCards(): Card[] {
  return [...store.cards].sort((a, b) => b.createdAt.localeCompare(a.createdAt))
}

export function cardById(id: string): Card | null {
  return store.cards.find((card) => card.id === id) ?? null
}

/** The card a given issue token already produced, if it produced one. */
export function cardByRequestId(requestId: string): Card | null {
  return store.cards.find((card) => card.requestId === requestId) ?? null
}

export interface IssueCardInput {
  merchantId: string
  nickname: string
  /** Integer minor units. Never a float. */
  limit: number
  currency: Currency
  category: CardCategory
  requestId: string
}

/** Returns the full number but never stores it: the record keeps last4 and a reference. */
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
    numberRef: `tok_${crypto.randomUUID()}`,
    limit: input.limit,
    spent: 0,
    currency: input.currency,
    category: input.category,
    status: "active",
    createdAt,
    requestId: input.requestId,
    statusHistory: [{ status: "active", at: createdAt }],
  }

  store.cards.push(card)
  return { card, fullNumber }
}

/** Replaces a card in the store with an updated copy of itself. */
export function replaceCard(card: Card): void {
  const index = store.cards.findIndex((existing) => existing.id === card.id)
  if (index !== -1) store.cards[index] = card
}
