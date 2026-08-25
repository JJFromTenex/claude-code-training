import { canTransition, generateCardNumber, CreateCardInput } from "@/lib/cards"
import { store } from "./store"
import { Card, CardStatus } from "./types"

const pad = (n: number, width = 6) => String(n).padStart(width, "0")

export function listCards(): Card[] {
  return [...store.cards].sort((a, b) => b.createdAt.localeCompare(a.createdAt))
}

export function cardById(id: string): Card | null {
  return store.cards.find((c) => c.id === id) ?? null
}

/**
 * The generated number is returned once, alongside the card, and never
 * stored — `Card` has no field for it.
 *
 * `input.requestId` guards against issuing twice for one user action (a
 * double-click race, or a client retrying a request whose response it
 * never saw). The key is only recorded once a card is actually created —
 * a request that failed validation never touched the store, so retrying
 * it after a fix still succeeds. This is a server-side guard; a disabled
 * submit button alone doesn't stop a network-level retry.
 */
export function createCard(
  input: CreateCardInput,
): { ok: true; card: Card; number: string } | { ok: false; status: 409; error: string } {
  if (store.issuedRequestIds.has(input.requestId)) {
    return { ok: false, status: 409, error: "This request has already been processed." }
  }

  const number = generateCardNumber()
  const card: Card = {
    id: `card_${pad(store.cards.length + 1)}`,
    nickname: input.nickname,
    merchantId: input.merchantId,
    currency: input.currency,
    spendLimit: input.spendLimit,
    spent: 0,
    last4: number.slice(-4),
    numberRef: `ref_${Math.random().toString(36).slice(2, 10)}`,
    status: "active",
    category: input.category,
    createdAt: new Date().toISOString(),
  }
  store.cards.push(card)
  store.issuedRequestIds.add(input.requestId)
  return { ok: true, card, number }
}

export function updateCardStatus(
  id: string,
  to: CardStatus,
):
  | { ok: true; card: Card }
  | { ok: false; status: 404; error: string }
  | { ok: false; status: 409; error: string } {
  const card = store.cards.find((c) => c.id === id)
  if (!card) return { ok: false, status: 404, error: "Card not found." }
  if (card.status === to) {
    return { ok: false, status: 409, error: `Card is already ${to}.` }
  }
  if (!canTransition(card.status, to)) {
    return { ok: false, status: 409, error: `Cannot move a ${card.status} card to ${to}.` }
  }
  card.status = to
  return { ok: true, card }
}
