import {
  IssueCardInput,
  canTransition,
  cardReference,
  generateCardNumber,
} from "@/lib/cards"
import { store } from "./store"
import { Card, CardStatus } from "./types"

/**
 * The one place cards are read and written. Route handlers and pages go
 * through here rather than touching the store, so the rules that make a card
 * safe — number generated on the server, never stored, transitions guarded —
 * hold in exactly one place.
 */

/** Newest first, which is the order ops wants after issuing one. */
export function listCards(): Card[] {
  return [...store.cards].sort((a, b) => b.createdAt.localeCompare(a.createdAt))
}

export function cardById(id: string): Card | null {
  return store.cards.find((card) => card.id === id) ?? null
}

function nextCardId(): string {
  const highest = store.cards.reduce((max, card) => {
    const n = Number(card.id.replace("card_", ""))
    return Number.isFinite(n) && n > max ? n : max
  }, 0)
  return `card_${String(highest + 1).padStart(4, "0")}`
}

/**
 * Issues a card and hands back the full number exactly once.
 *
 * The number is deliberately returned beside the record rather than on it —
 * `Card` has no field to put it in, so it cannot leak into a later response.
 */
export function issueCard(input: IssueCardInput): {
  card: Card
  cardNumber: string
} {
  const cardNumber = generateCardNumber()

  const card: Card = {
    id: nextCardId(),
    merchantId: input.merchantId,
    nickname: input.nickname,
    spendLimit: input.spendLimit,
    spend: 0,
    currency: input.currency,
    status: "active",
    last4: cardNumber.slice(-4),
    reference: cardReference(),
    category: input.category,
    createdAt: new Date().toISOString(),
  }

  store.cards.push(card)
  return { card, cardNumber }
}

export type TransitionResult =
  | { ok: true; card: Card }
  | { ok: false; status: 404 | 409; message: string }

/** Guarded here, not in the UI. A cancelled card never comes back. */
export function setCardStatus(id: string, to: CardStatus): TransitionResult {
  const card = cardById(id)
  if (!card) return { ok: false, status: 404, message: "No card with that id." }

  if (!canTransition(card.status, to)) {
    return {
      ok: false,
      status: 409,
      message:
        card.status === "cancelled"
          ? "This card was cancelled, and cancelling is permanent."
          : `A ${card.status} card cannot become ${to}.`,
    }
  }

  card.status = to
  return { ok: true, card }
}
