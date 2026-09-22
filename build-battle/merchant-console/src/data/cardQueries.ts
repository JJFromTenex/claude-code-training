import {
  ALLOWED_CURRENCIES,
  CARD_CATEGORIES,
  MAX_LIMIT_MINOR_UNITS,
  canTransition,
  generateCardNumber,
} from "@/lib/cards"
import { parseAmountToMinorUnits } from "@/lib/money"
import { merchantById } from "./merchants"
import { store } from "./store"
import { Card, CardCategory, CardStatus, Currency } from "./types"

/**
 * The one place that touches store.cards. Mirrors, not reuses, the payment
 * query builder in ./queries.ts — the shapes are different enough that
 * forcing cards through it would be a second-filter-path in the other
 * direction.
 */

export function listCards(): Card[] {
  return [...store.cards].sort((a, b) => b.createdAt.localeCompare(a.createdAt))
}

export function cardById(id: string): Card | null {
  return store.cards.find((c) => c.id === id) ?? null
}

export interface IssueCardInput {
  nickname: string
  merchantId: string
  category: string
  limit: string
  currency: string
  requestId?: string
}

export type IssueCardResult =
  | { ok: true; card: Card; number: string }
  | { ok: false; status: number; error: string }

export function issueCard(input: IssueCardInput): IssueCardResult {
  // Reveal-once is absolute: a replayed idempotent request cannot re-reveal
  // the original number (it was never stored), so a repeat only confirms the
  // card that already exists, with an empty number.
  if (input.requestId) {
    const existing = store.cards.find((c) => c.requestId === input.requestId)
    if (existing) {
      return { ok: true, card: existing, number: "" }
    }
  }

  const nickname = input.nickname.trim()
  if (!nickname) {
    return { ok: false, status: 400, error: "Nickname is required." }
  }

  if (!input.merchantId) {
    return { ok: false, status: 400, error: "Merchant is required." }
  }
  const merchant = merchantById(input.merchantId)
  if (!merchant) {
    return { ok: false, status: 400, error: "Unknown merchant." }
  }

  if (!CARD_CATEGORIES.includes(input.category as CardCategory)) {
    return { ok: false, status: 400, error: "Invalid card category." }
  }
  const category = input.category as CardCategory

  const limit = parseAmountToMinorUnits(input.limit)
  if (limit === null) {
    return { ok: false, status: 400, error: "Spend limit must be a valid amount." }
  }
  if (limit <= 0) {
    return { ok: false, status: 400, error: "Spend limit must be greater than zero." }
  }
  if (limit > MAX_LIMIT_MINOR_UNITS) {
    return {
      ok: false,
      status: 400,
      error: "Spend limit cannot exceed 5,000,000 minor units.",
    }
  }

  if (!ALLOWED_CURRENCIES.includes(input.currency as Currency)) {
    return { ok: false, status: 400, error: "Currency must be USD, EUR, or GBP." }
  }
  const currency = input.currency as Currency
  if (currency !== merchant.currency) {
    return {
      ok: false,
      status: 400,
      error: `Card currency must match the merchant's currency (${merchant.currency}).`,
    }
  }

  const number = generateCardNumber()
  const last4 = number.slice(-4)
  const numberRef = "ref_" + crypto.randomUUID()
  const id = "card_" + crypto.randomUUID()
  const createdAt = new Date().toISOString()

  const card: Card = {
    id,
    nickname,
    merchantId: merchant.id,
    category,
    currency,
    limit,
    spent: 0,
    status: "active",
    last4,
    numberRef,
    requestId: input.requestId ?? null,
    createdAt,
    history: [{ from: null, to: "active", at: createdAt }],
  }

  store.cards.push(card)

  return { ok: true, card, number }
}

export type TransitionResult =
  | { ok: true; card: Card }
  | { ok: false; status: number; error: string }

const VALID_STATUSES: readonly CardStatus[] = ["active", "frozen", "cancelled"]

export function transitionCardStatus(id: string, toRaw: string): TransitionResult {
  if (!VALID_STATUSES.includes(toRaw as CardStatus)) {
    return { ok: false, status: 400, error: "Invalid status." }
  }
  const to = toRaw as CardStatus

  const card = cardById(id)
  if (!card) {
    return { ok: false, status: 404, error: "Card not found." }
  }

  if (!canTransition(card.status, to)) {
    return {
      ok: false,
      status: 409,
      error: `Cannot move a card from ${card.status} to ${to}.`,
    }
  }

  card.history.push({ from: card.status, to, at: new Date().toISOString() })
  card.status = to

  return { ok: true, card }
}
