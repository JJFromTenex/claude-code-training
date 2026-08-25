import { CARD_STATUSES, canTransition, generateCardNumber } from "@/lib/cards"
import { merchantById } from "./merchants"
import { store } from "./store"
import { Card, CardCategory, CardStatus, Currency } from "./types"

/**
 * Card reads and writes against the in-memory store. Everything from the
 * client is validated here, against allowlists, before it touches the store.
 * Route handlers call these rather than reading bodies themselves.
 */

/** 5,000,000 minor units — the ceiling ops is allowed to issue. */
export const MAX_SPEND_LIMIT = 5_000_000

const CURRENCIES: readonly Currency[] = ["USD", "EUR", "GBP"]

export const CARD_CATEGORIES: readonly CardCategory[] = [
  "advertising",
  "software",
  "travel",
  "office_supplies",
  "professional_services",
]

export interface CreateCardInput {
  nickname: string
  merchantId: string
  spendLimit: number
  currency: Currency
  categoryLock: CardCategory | null
  /** Client-supplied key so a retried or double-clicked submit issues one card. */
  idempotencyKey: string | null
}

export type ParseCardResult =
  | { ok: true; input: CreateCardInput }
  | { ok: false; error: string }

/** Validate an untrusted creation body. Reject early and return. */
export function parseCreateCard(body: unknown): ParseCardResult {
  if (typeof body !== "object" || body === null) {
    return { ok: false, error: "Request body must be a JSON object." }
  }
  const raw = body as Record<string, unknown>

  const nickname = typeof raw.nickname === "string" ? raw.nickname.trim() : ""
  if (!nickname) {
    return { ok: false, error: "A nickname is required." }
  }

  const merchantId = typeof raw.merchantId === "string" ? raw.merchantId : ""
  if (!merchantId) {
    return { ok: false, error: "A merchant is required." }
  }
  const merchant = merchantById(merchantId)
  if (!merchant) {
    return { ok: false, error: "Unknown merchant." }
  }

  const spendLimit = raw.spendLimit
  if (typeof spendLimit !== "number" || !Number.isInteger(spendLimit)) {
    return {
      ok: false,
      error: "Spend limit must be an integer amount in minor units.",
    }
  }
  if (spendLimit <= 0) {
    return { ok: false, error: "Spend limit must be greater than zero." }
  }
  if (spendLimit > MAX_SPEND_LIMIT) {
    return {
      ok: false,
      error: `Spend limit cannot exceed ${MAX_SPEND_LIMIT} minor units.`,
    }
  }

  const currency = raw.currency
  if (!CURRENCIES.includes(currency as Currency)) {
    return { ok: false, error: "Currency must be USD, EUR, or GBP." }
  }
  // A card settles in its merchant's currency; a mismatch is how limits go wrong.
  if (currency !== merchant.currency) {
    return {
      ok: false,
      error: `Currency must match the merchant's settlement currency (${merchant.currency}).`,
    }
  }

  let idempotencyKey: string | null = null
  if (raw.idempotencyKey != null && raw.idempotencyKey !== "") {
    if (
      typeof raw.idempotencyKey !== "string" ||
      raw.idempotencyKey.length > 128
    ) {
      return { ok: false, error: "Invalid idempotency key." }
    }
    idempotencyKey = raw.idempotencyKey
  }

  let categoryLock: CardCategory | null = null
  if (raw.categoryLock != null && raw.categoryLock !== "") {
    if (!CARD_CATEGORIES.includes(raw.categoryLock as CardCategory)) {
      return { ok: false, error: "Unknown merchant category." }
    }
    categoryLock = raw.categoryLock as CardCategory
  }

  return {
    ok: true,
    input: {
      nickname,
      merchantId,
      spendLimit,
      currency: currency as Currency,
      categoryLock,
      idempotencyKey,
    },
  }
}

export function listCards(): Card[] {
  return [...store.cards].sort((a, b) => b.createdAt.localeCompare(a.createdAt))
}

export function cardById(id: string): Card | null {
  return store.cards.find((c) => c.id === id) ?? null
}

const pad = (n: number, width = 4) => String(n).padStart(width, "0")

function nextCardSeq(): number {
  return store.cards.reduce((max, card) => {
    const seq = Number(card.id.replace("card_", ""))
    return Number.isFinite(seq) && seq > max ? seq : max
  }, 0) + 1
}

/**
 * Issue a card. Returns the stored record plus the full number, which the
 * caller returns once and nobody stores. Only `last4` and a reference persist.
 *
 * A repeated idempotency key returns the already-issued card as a replay,
 * without the number — the full number exists in exactly one response.
 */
export function createCard(
  input: CreateCardInput,
):
  | { replayed: false; card: Card; number: string }
  | { replayed: true; card: Card } {
  if (input.idempotencyKey) {
    const existingId = store.cardIdempotency[input.idempotencyKey]
    const existing = existingId ? cardById(existingId) : null
    if (existing) return { replayed: true, card: existing }
  }
  const number = generateCardNumber()
  const seq = nextCardSeq()
  const now = new Date().toISOString()
  const card: Card = {
    id: `card_${pad(seq)}`,
    merchantId: input.merchantId,
    nickname: input.nickname,
    last4: number.slice(-4),
    numberRef: `cardnum_${pad(seq)}`,
    spendLimit: input.spendLimit,
    spent: 0,
    currency: input.currency,
    status: "active",
    categoryLock: input.categoryLock,
    createdAt: now,
    history: [{ at: now, event: "issued" }],
  }
  store.cards.push(card)
  if (input.idempotencyKey) {
    store.cardIdempotency[input.idempotencyKey] = card.id
  }
  return { replayed: false, card, number }
}

export type TransitionResult =
  | { ok: true; card: Card }
  | { ok: false; status: 404 | 409 | 400; error: string }

/** Apply a status change, guarded by the state machine. */
export function transitionCard(id: string, to: unknown): TransitionResult {
  if (!CARD_STATUSES.includes(to as CardStatus)) {
    return { ok: false, status: 400, error: "Unknown card status." }
  }
  const card = cardById(id)
  if (!card) {
    return { ok: false, status: 404, error: "Card not found." }
  }
  if (!canTransition(card.status, to as CardStatus)) {
    return {
      ok: false,
      status: 409,
      error: `A ${card.status} card cannot become ${to}.`,
    }
  }
  const next = to as CardStatus
  card.status = next
  card.history.push({
    at: new Date().toISOString(),
    event:
      next === "active" ? "unfrozen" : next === "frozen" ? "frozen" : "cancelled",
  })
  return { ok: true, card }
}
