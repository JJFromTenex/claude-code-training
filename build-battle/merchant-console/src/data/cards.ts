import {
  CardIssueInput,
  canTransition,
  generateCardNumber,
  lastFour,
} from "@/lib/cards"
import { store } from "./store"
import { Card, CardStatus } from "./types"

/**
 * The one card query path. Pages read through it the way the payments pages
 * read through the payment query builder; route handlers use it for writes.
 */

const CARD_STATUSES: readonly (CardStatus | "all")[] = [
  "all",
  "active",
  "frozen",
  "cancelled",
]

export interface CardFilters {
  status?: CardStatus | "all"
  merchantId?: string
}

/** Anything from the client is checked against the allowlist before it lands here. */
export function parseCardFilters(params: URLSearchParams): CardFilters {
  const status = params.get("status")
  const merchantId = params.get("merchantId")

  return {
    status: CARD_STATUSES.includes(status as CardStatus)
      ? (status as CardStatus)
      : "all",
    merchantId:
      merchantId && store.merchants.some((m) => m.id === merchantId)
        ? merchantId
        : undefined,
  }
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

export function cardCountsByStatus(): Record<CardStatus | "all", number> {
  const counts = { all: 0, active: 0, frozen: 0, cancelled: 0 }
  for (const card of store.cards) {
    counts.all += 1
    counts[card.status] += 1
  }
  return counts
}

function nextCardId(): string {
  const highest = store.cards.reduce((max, card) => {
    const n = Number(card.id.replace("card_", ""))
    return Number.isFinite(n) && n > max ? n : max
  }, 0)
  return `card_${String(highest + 1).padStart(4, "0")}`
}

/**
 * Issue a card.
 *
 * The generated number is returned to the caller once and never written to the
 * store — the record keeps the last four only. Callers must not persist,
 * log, or echo `fullNumber` anywhere else.
 */
export function issueCard(input: CardIssueInput): {
  card: Card
  fullNumber: string
} {
  const fullNumber = generateCardNumber()

  const card: Card = {
    id: nextCardId(),
    nickname: input.nickname,
    merchantId: input.merchantId,
    last4: lastFour(fullNumber),
    spendLimit: input.spendLimit,
    spent: 0,
    currency: input.currency,
    status: "active",
    createdAt: new Date().toISOString(),
    categoryLock: input.categoryLock,
  }

  store.cards.push(card)
  return { card, fullNumber }
}

export type StatusChangeResult =
  | { ok: true; card: Card }
  | { ok: false; reason: "not_found" | "illegal_transition"; message: string }

/**
 * Move a card through the state machine.
 *
 * Guarded here rather than in the route so the rule holds for every caller:
 * active ⇄ frozen, either to cancelled, and cancelled is terminal.
 */
export function setCardStatus(
  id: string,
  next: CardStatus,
): StatusChangeResult {
  const card = cardById(id)
  if (!card) {
    return { ok: false, reason: "not_found", message: "That card does not exist." }
  }

  if (!canTransition(card.status, next)) {
    return {
      ok: false,
      reason: "illegal_transition",
      message:
        card.status === "cancelled"
          ? "This card was cancelled. Cancelled cards cannot be changed."
          : card.status === next
            ? `This card is already ${next}.`
            : `A card cannot go from ${card.status} to ${next}.`,
    }
  }

  card.status = next
  return { ok: true, card }
}
