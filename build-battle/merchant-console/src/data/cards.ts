import {
  CARD_CATEGORIES,
  MAX_SPEND_LIMIT,
  canTransition,
  generateCardNumber,
  lastFour,
} from "@/lib/cards"
import { merchantById } from "./merchants"
import { store } from "./store"
import { Card, CardCategory, CardStatus, Currency } from "./types"

/** Card reads and writes against the store, and the validation that guards them. Route handlers call these, never `store.cards`. */

const CURRENCIES: readonly Currency[] = ["USD", "EUR", "GBP"]
const CARD_STATUSES: readonly CardStatus[] = ["active", "frozen", "cancelled"]

const MAX_NICKNAME_LENGTH = 60

export interface IssueCardInput {
  merchantId: string
  nickname: string
  category: CardCategory
  spendLimit: number
  currency: Currency
  /** Optional client token so a retried submit cannot issue two cards. */
  idempotencyKey?: string
}

export type ParseResult<T> =
  | { ok: true; value: T }
  | { ok: false; error: string }

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

/** Validate a client body. Every field is allowlisted or bounded before it can reach the store; messages are user-safe. */
export function parseIssueCardInput(body: unknown): ParseResult<IssueCardInput> {
  if (!isRecord(body)) return { ok: false, error: "Request body must be an object." }

  const merchantId = typeof body.merchantId === "string" ? body.merchantId.trim() : ""
  if (!merchantId) return { ok: false, error: "Choose a merchant." }
  const merchant = merchantById(merchantId)
  if (!merchant) return { ok: false, error: "That merchant does not exist." }

  const nickname = typeof body.nickname === "string" ? body.nickname.trim() : ""
  if (!nickname) return { ok: false, error: "Give the card a nickname." }
  if (nickname.length > MAX_NICKNAME_LENGTH) {
    return { ok: false, error: `Nickname must be ${MAX_NICKNAME_LENGTH} characters or fewer.` }
  }

  const spendLimit = body.spendLimit
  if (typeof spendLimit !== "number" || !Number.isInteger(spendLimit)) {
    return { ok: false, error: "Spend limit must be a whole number of minor units." }
  }
  if (spendLimit <= 0) return { ok: false, error: "Spend limit must be greater than zero." }
  if (spendLimit > MAX_SPEND_LIMIT) {
    return {
      ok: false,
      error: `Spend limit cannot exceed ${MAX_SPEND_LIMIT.toLocaleString("en-US")} minor units.`,
    }
  }

  const currency = body.currency
  if (typeof currency !== "string" || !CURRENCIES.includes(currency as Currency)) {
    return { ok: false, error: "Currency must be USD, EUR, or GBP." }
  }
  if (currency !== merchant.currency) {
    return { ok: false, error: `${merchant.name} settles in ${merchant.currency}; issue the card in ${merchant.currency}.` }
  }

  const category = body.category ?? "any"
  if (typeof category !== "string" || !CARD_CATEGORIES.includes(category as CardCategory)) {
    return { ok: false, error: "Choose a category from the list." }
  }

  const idempotencyKey = body.idempotencyKey
  if (idempotencyKey !== undefined && (typeof idempotencyKey !== "string" || !/^[\w-]{8,64}$/.test(idempotencyKey))) {
    return { ok: false, error: "Idempotency key must be 8-64 letters, digits, - or _." }
  }

  return {
    ok: true,
    value: {
      merchantId,
      nickname,
      category: category as CardCategory,
      spendLimit,
      currency: currency as Currency,
      idempotencyKey,
    },
  }
}

export function parseCardStatus(value: unknown): CardStatus | null {
  return typeof value === "string" && CARD_STATUSES.includes(value as CardStatus)
    ? (value as CardStatus)
    : null
}

const pad = (n: number, width: number) => String(n).padStart(width, "0")

/** Idempotency keys already used, so a retried POST returns the same card. Lives with the store. */
const issuedByKey = new Map<string, string>()

export type IssueResult =
  | { replayed: false; card: Card; number: string }
  | { replayed: true; card: Card }

/** Create a card. The full number is returned once, on the first call; a replay returns the card without it. */
export function issueCard(input: IssueCardInput): IssueResult {
  if (input.idempotencyKey) {
    const existingId = issuedByKey.get(input.idempotencyKey)
    const existing = existingId ? cardById(existingId) : undefined
    if (existing) return { replayed: true, card: existing }
  }

  const number = generateCardNumber()
  const seq = store.cards.length + 1
  const createdAt = new Date().toISOString()
  const card: Card = {
    id: `card_${pad(seq, 4)}`,
    merchantId: input.merchantId,
    nickname: input.nickname,
    category: input.category,
    last4: lastFour(number),
    numberRef: `cn_${pad(seq, 6)}`,
    spendLimit: input.spendLimit,
    spent: 0,
    currency: input.currency,
    status: "active",
    history: [{ status: "active", at: createdAt }],
    createdAt,
  }
  store.cards.push(card)
  if (input.idempotencyKey) issuedByKey.set(input.idempotencyKey, card.id)
  return { replayed: false, card, number }
}

/** Newest first, so a card issued a moment ago is at the top of the list. */
export function listCards(): Card[] {
  return [...store.cards].sort((a, b) => b.createdAt.localeCompare(a.createdAt))
}

export function cardById(id: string): Card | undefined {
  return store.cards.find((card) => card.id === id)
}

export type TransitionResult =
  | { ok: true; card: Card }
  | { ok: false; status: 404 | 409; error: string }

/** Move a card through the state machine; illegal moves are refused here, not only in the UI. */
export function transitionCard(id: string, to: CardStatus): TransitionResult {
  const card = cardById(id)
  if (!card) return { ok: false, status: 404, error: "Card not found." }
  if (!canTransition(card.status, to)) {
    return {
      ok: false,
      status: 409,
      error:
        card.status === "cancelled"
          ? "A cancelled card cannot be changed."
          : `Cannot move a ${card.status} card to ${to}.`,
    }
  }
  card.status = to
  card.history.push({ status: to, at: new Date().toISOString() })
  return { ok: true, card }
}
