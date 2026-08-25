import {
  canTransition,
  generateCardNumber,
  IssueCardInput,
  lastFour,
  spendForCard,
} from "@/lib/cards"
import { store } from "./store"
import { Card, CardStatus } from "./types"

/**
 * Card reads and writes against the in-memory store.
 *
 * Separate from the payments builder in `queries.ts` on purpose: cards are not
 * filtered payments, and folding them into that builder would give it two jobs.
 */

/** Newest first, which is the order ops asks for them in. */
export function listCards(): Card[] {
  return [...store.cards].sort((a, b) => b.createdAt.localeCompare(a.createdAt))
}

export function cardById(id: string): Card | null {
  return store.cards.find((card) => card.id === id) ?? null
}

/** Spend against this card, derived from the payment data at read time. */
export function cardSpend(card: Card): number {
  return spendForCard(store.payments, card)
}

function nextCardId(): string {
  const sequence = store.cards.length + 1
  return `card_${String(sequence).padStart(4, "0")}`
}

export interface IssuedCard {
  card: Card
  /**
   * The full number. Returned by the issue call exactly once and never stored;
   * `Card` has no field that could hold it.
   */
  cardNumber: string
  /** True when an existing card was returned for a repeated request id. */
  replayed: boolean
}

/**
 * Mint a card and put it in the store.
 *
 * When `requestId` is supplied and has been seen before, the original card is
 * returned instead of a second one being minted — a double-clicked form or a
 * client retry after a timeout must not cost the merchant two cards. The full
 * number cannot be replayed, because it was never kept.
 *
 * @param input - Values already validated by the route handler
 * @param requestId - Caller-supplied idempotency key, or null
 */
export function issueCard(
  input: IssueCardInput,
  requestId: string | null,
): IssuedCard {
  if (requestId !== null) {
    const existing = store.cards.find((card) => card.requestId === requestId)
    if (existing !== undefined) {
      return { card: existing, cardNumber: "", replayed: true }
    }
  }

  const cardNumber = generateCardNumber(Math.random)
  const now = new Date().toISOString()

  const card: Card = {
    id: nextCardId(),
    nickname: input.nickname,
    merchantId: input.merchantId,
    last4: lastFour(cardNumber),
    spendLimit: input.spendLimit,
    currency: input.currency,
    status: "active",
    categoryLock: input.categoryLock,
    createdAt: now,
    history: [{ from: null, to: "active", at: now }],
    requestId,
  }

  store.cards.push(card)
  return { card, cardNumber, replayed: false }
}

export type TransitionResult =
  | { ok: true; card: Card }
  | { ok: false; reason: "not_found"; card: null }
  | { ok: false; reason: "illegal_transition"; card: Card }

/**
 * Move a card to a new status, refusing anything the state machine forbids.
 *
 * The guard lives here rather than in the UI: `cancelled` is terminal, and a
 * request that tries to reverse it is refused whatever the client believes.
 */
export function transitionCardStatus(
  id: string,
  to: CardStatus,
): TransitionResult {
  const card = cardById(id)
  if (card === null) return { ok: false, reason: "not_found", card: null }

  if (!canTransition(card.status, to)) {
    return { ok: false, reason: "illegal_transition", card }
  }

  card.history.push({ from: card.status, to, at: new Date().toISOString() })
  card.status = to
  return { ok: true, card }
}
