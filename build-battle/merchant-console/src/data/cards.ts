import {
  canTransition,
  generateCardNumber,
  IssueCardInput,
} from "@/lib/cards"
import { store } from "./store"
import { Card, CardEventType, CardFilters, CardStatus } from "./types"

/**
 * Card reads and writes against the in-memory store.
 *
 * Issuing is the only place a full number exists, and it leaves this module
 * in the return value rather than on the record. Nothing here stores it.
 */

const pad = (n: number, width = 6) => String(n).padStart(width, "0")

function nextCardId(): string {
  const highest = store.cards.reduce((max, card) => {
    const n = Number(card.id.slice("card_".length))
    return Number.isFinite(n) && n > max ? n : max
  }, 0)
  return `card_${pad(highest + 1)}`
}

/** Opaque handle for an issued number. Random, never derived from the number. */
function newReference(rand: () => number = Math.random): string {
  let out = ""
  while (out.length < 12) out += Math.floor(rand() * 36).toString(36)
  return `cref_${out.slice(0, 12)}`
}

export function listCards(filters: CardFilters = {}): Card[] {
  const { status, merchantId } = filters
  return store.cards
    .filter((card) => {
      if (status && status !== "all" && card.status !== status) return false
      if (merchantId && card.merchantId !== merchantId) return false
      return true
    })
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
}

export function cardById(id: string): Card | null {
  return store.cards.find((card) => card.id === id) ?? null
}

/**
 * Issues a card and returns the full number exactly once. The caller passes
 * it straight to the response; it is never written to the record, a log, or
 * a later read.
 */
export function issueCard(input: IssueCardInput): {
  card: Card
  number: string
} {
  const number = generateCardNumber()
  const now = new Date().toISOString()

  const card: Card = {
    id: nextCardId(),
    merchantId: input.merchantId,
    nickname: input.nickname,
    spendLimit: input.spendLimit,
    spend: 0,
    currency: input.currency,
    status: "active",
    last4: number.slice(-4),
    reference: newReference(),
    categoryLock: input.categoryLock,
    createdAt: now,
    events: [{ type: "issued", at: now }],
  }

  store.cards.push(card)
  return { card, number }
}

const EVENT_FOR: Record<CardStatus, CardEventType> = {
  active: "unfrozen",
  frozen: "frozen",
  cancelled: "cancelled",
}

export type StatusChange =
  | { ok: true; card: Card }
  | { ok: false; error: string; status: number }

/**
 * Moves a card through the state machine. The transition is checked here, on
 * the server, so a stale tab or a hand-rolled request cannot revive a
 * cancelled card.
 */
export function setCardStatus(id: string, next: CardStatus): StatusChange {
  const card = cardById(id)
  if (!card) return { ok: false, error: "No such card.", status: 404 }

  if (card.status === next) {
    return { ok: false, error: `Card is already ${next}.`, status: 409 }
  }
  if (!canTransition(card.status, next)) {
    return {
      ok: false,
      error:
        card.status === "cancelled"
          ? "A cancelled card cannot be changed."
          : `A ${card.status} card cannot become ${next}.`,
      status: 409,
    }
  }

  card.status = next
  card.events.push({ type: EVENT_FOR[next], at: new Date().toISOString() })
  return { ok: true, card }
}
