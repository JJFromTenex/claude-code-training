import { generateCardNumber } from "@/lib/luhn"
import { store } from "./store"
import { Card, CardStatus, Currency } from "./types"

/**
 * Legal status transitions. `active` and `frozen` move to each other or to
 * `cancelled`; `cancelled` is terminal. Enforced here, and only here — the
 * route handler has no transition logic of its own.
 */
const ALLOWED_TRANSITIONS: Record<CardStatus, readonly CardStatus[]> = {
  active: ["frozen", "cancelled"],
  frozen: ["active", "cancelled"],
  cancelled: [],
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
  /** Integer minor units. */
  limit: number
  currency: Currency
  category?: string
}

/**
 * The only function in the codebase allowed to produce a full card number.
 * The number is returned once, alongside the stored (masked) card, and is
 * never written to the store or returned again by any other function.
 */
export function createCard(
  input: CreateCardInput,
): { card: Card; fullNumber: string } {
  const fullNumber = generateCardNumber()

  const card: Card = {
    id: `card_${crypto.randomUUID()}`,
    nickname: input.nickname,
    merchantId: input.merchantId,
    currency: input.currency,
    limit: input.limit,
    status: "active",
    last4: fullNumber.slice(-4),
    numberRef: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
    category: input.category,
  }

  store.cards.push(card)
  return { card, fullNumber }
}

/** Thrown by `setCardStatus` when `next` is not reachable from the card's current status. */
export class IllegalStatusTransitionError extends Error {
  constructor(from: CardStatus, to: CardStatus) {
    super(`Cannot move a card from "${from}" to "${to}"`)
    this.name = "IllegalStatusTransitionError"
  }
}

/**
 * Drives the status state machine. Returns `null` if no card matches `id`
 * (mirroring `cardById`'s not-found return), or throws
 * `IllegalStatusTransitionError` if `next` is not reachable from the card's
 * current status — the two failure modes map to different HTTP statuses, so
 * they stay distinguishable here rather than collapsing to one signal.
 */
export function setCardStatus(id: string, next: CardStatus): Card | null {
  const card = cardById(id)
  if (!card) return null

  if (!ALLOWED_TRANSITIONS[card.status].includes(next)) {
    throw new IllegalStatusTransitionError(card.status, next)
  }

  card.status = next
  return card
}
