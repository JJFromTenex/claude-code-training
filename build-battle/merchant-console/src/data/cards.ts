import { canTransition, generateCardNumber } from "@/lib/cards"
import { store } from "./store"
import { Card, CardStatus, Currency } from "./types"

/**
 * Card reads and writes against the in-memory store. Mirrors the shape of
 * `queries.ts`: the route handlers call these rather than touching the store
 * directly. No persistence — cards live for the life of the dev server.
 */

export interface IssueCardInput {
  nickname: string
  merchantId: string
  /** Integer minor units, already validated at the route boundary. */
  limit: number
  currency: Currency
}

/** The one-time issue result. The full number is here and nowhere else. */
export interface IssuedCard {
  card: Card
  /** Full PAN — returned exactly once, never stored. Do not persist or log. */
  fullNumber: string
}

// Seeded from the store so a dev-server module reload never reuses an id.
let cardSeq = store.cards.length

const nextCardId = () => `card_${String(++cardSeq).padStart(4, "0")}`
const newReference = () => `cref_${Math.random().toString(36).slice(2, 10)}`

/**
 * Issue a virtual card. Generates the number server-side, keeps only the last
 * four and an opaque reference on the record, and returns the full number once.
 */
export function issueCard(input: IssueCardInput): IssuedCard {
  const fullNumber = generateCardNumber()
  const card: Card = {
    id: nextCardId(),
    nickname: input.nickname,
    merchantId: input.merchantId,
    limit: input.limit,
    spend: 0,
    currency: input.currency,
    last4: fullNumber.slice(-4),
    reference: newReference(),
    status: "active",
    createdAt: new Date().toISOString(),
  }
  store.cards.push(card)
  return { card, fullNumber }
}

/** Every issued card, newest first. Records carry `last4` only — never a PAN. */
export function listCards(): Card[] {
  return [...store.cards].sort((a, b) => b.createdAt.localeCompare(a.createdAt))
}

export function cardById(id: string): Card | null {
  return store.cards.find((c) => c.id === id) ?? null
}

export type StatusChange =
  | { ok: true; card: Card }
  | { ok: false; reason: "not_found" | "illegal_transition" }

/**
 * Move a card to a new status, enforcing the state machine on the server.
 * Returns a reason on failure so the route can pick the right status code.
 */
export function setCardStatus(id: string, next: CardStatus): StatusChange {
  const card = cardById(id)
  if (!card) return { ok: false, reason: "not_found" }
  if (!canTransition(card.status, next)) {
    return { ok: false, reason: "illegal_transition" }
  }
  card.status = next
  return { ok: true, card }
}
