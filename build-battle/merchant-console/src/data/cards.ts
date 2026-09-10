import { canTransition, generateCardNumber } from "@/lib/cards"
import { randomUUID } from "crypto"
import { store } from "./store"
import { Card, CardEventType, CardStatus, IssueCardInput } from "./types"

/**
 * Card reads and writes against the in-memory store. Mirrors the shape of
 * `queries.ts`: route handlers call these rather than touching `store.cards`.
 *
 * The full card number exists in exactly one place: the return value of
 * `issueCard`, as a value beside the record. It is never on the record.
 */

const pad = (n: number, width = 6) => String(n).padStart(width, "0")

/** Newest first, because ops is usually looking for the one they just issued. */
export function listCards(): Card[] {
  return [...store.cards].sort((a, b) => b.createdAt.localeCompare(a.createdAt))
}

export function cardById(id: string): Card | null {
  return store.cards.find((card) => card.id === id) ?? null
}

/**
 * Generates the number on the server, stores the last four and an opaque
 * reference, and hands the full number back once. Callers must not keep it.
 */
export function issueCard(
  input: IssueCardInput,
  now: Date = new Date(),
): { card: Card; number: string } {
  const number = generateCardNumber()
  const createdAt = now.toISOString()

  const card: Card = {
    id: `card_${pad(store.cards.length + 1)}`,
    merchantId: input.merchantId,
    nickname: input.nickname,
    last4: number.slice(-4),
    numberRef: `cn_${randomUUID().replace(/-/g, "").slice(0, 16)}`,
    spendLimit: input.spendLimit,
    spent: 0,
    currency: input.currency,
    status: "active",
    categoryLock: input.categoryLock,
    createdAt,
    events: [{ type: "issued", at: createdAt }],
  }

  store.cards.push(card)
  return { card, number }
}

/** The event a transition writes, keyed by the status it lands on. */
const EVENT_FOR: Record<CardStatus, CardEventType> = {
  active: "unfrozen",
  frozen: "frozen",
  cancelled: "cancelled",
}

export type TransitionResult =
  | { ok: true; card: Card }
  | { ok: false; reason: "not_found" }
  | { ok: false; reason: "invalid_transition"; card: Card }

/**
 * Moves a card through the state machine, or refuses. The guard lives here,
 * on the server, not only in the buttons that call it.
 */
export function transitionCard(
  id: string,
  to: CardStatus,
  now: Date = new Date(),
): TransitionResult {
  const card = cardById(id)
  if (!card) return { ok: false, reason: "not_found" }
  if (!canTransition(card.status, to)) {
    return { ok: false, reason: "invalid_transition", card }
  }

  card.status = to
  card.events.push({ type: EVENT_FOR[to], at: now.toISOString() })
  return { ok: true, card }
}
