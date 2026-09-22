import { canTransition } from "@/lib/card-status"
import { cardReference, generateCardNumber } from "@/lib/card-number"
import { nextCardId } from "@/lib/cards"
import { merchantById } from "./merchants"
import { store } from "./store"
import { Card, CardStatus, Currency, IssuedCard } from "./types"

/**
 * The one card query and validation module. Anything arriving from the client
 * is checked here, against an allowlist, before it reaches the store. Route
 * handlers call these rather than validating inline.
 */

const CURRENCIES: readonly string[] = ["USD", "EUR", "GBP"]

/** Spend limits are integer minor units: one of them up to five million. */
export const MIN_SPEND_LIMIT = 1
export const MAX_SPEND_LIMIT = 5_000_000

export interface CardInput {
  nickname: string
  merchantId: string
  /** Integer minor units. Never a float. */
  spendLimit: number
  currency: Currency
}

export type FieldErrors = Record<string, string>

/** Validate a create body into clean input, or the per-field reasons it was refused. */
export function parseCardInput(
  body: unknown,
): { input: CardInput } | { errors: FieldErrors } {
  const errors: FieldErrors = {}
  const raw = (body ?? {}) as Record<string, unknown>

  const nickname = typeof raw.nickname === "string" ? raw.nickname.trim() : ""
  if (!nickname) errors.nickname = "Give the card a nickname."

  const merchantId = typeof raw.merchantId === "string" ? raw.merchantId : ""
  if (!merchantId) errors.merchantId = "Choose a merchant."
  else if (!merchantById(merchantId)) {
    errors.merchantId = "That merchant does not exist."
  }

  const spendLimit = raw.spendLimit
  if (typeof spendLimit !== "number" || !Number.isInteger(spendLimit)) {
    errors.spendLimit = "Spend limit must be a whole number of minor units."
  } else if (spendLimit < MIN_SPEND_LIMIT) {
    errors.spendLimit = "Spend limit must be greater than zero."
  } else if (spendLimit > MAX_SPEND_LIMIT) {
    errors.spendLimit = "Spend limit cannot exceed 5,000,000 minor units."
  }

  const currency = raw.currency
  if (typeof currency !== "string" || !CURRENCIES.includes(currency)) {
    errors.currency = "Currency must be USD, EUR, or GBP."
  }

  if (Object.keys(errors).length > 0) return { errors }

  return {
    input: {
      nickname,
      merchantId,
      spendLimit: spendLimit as number,
      currency: currency as Currency,
    },
  }
}

/**
 * Every issued card, newest first. Cancelled cards are held back unless asked
 * for: they are terminal, they accumulate, and ops is normally looking at the
 * cards that can still spend.
 */
export function listCards({ includeCancelled = false } = {}): Card[] {
  return [...store.cards]
    .filter((card) => includeCancelled || card.status !== "cancelled")
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
}

export function cardById(id: string): Card | null {
  return store.cards.find((card) => card.id === id) ?? null
}

/**
 * Issue a card. The full number exists in the returned value and nowhere
 * else: the stored record keeps only the last four and the reference.
 */
export function issueCard(input: CardInput, now = new Date()): IssuedCard {
  const number = generateCardNumber()
  const card: Card = {
    id: nextCardId(store.cards),
    nickname: input.nickname,
    merchantId: input.merchantId,
    spendLimit: input.spendLimit,
    spent: 0,
    currency: input.currency,
    status: "active",
    last4: number.slice(-4),
    reference: cardReference(),
    createdAt: now.toISOString(),
  }
  store.cards.push(card)
  return { ...card, number }
}

/** Move a card's status, or refuse it. The transition table is the authority. */
export function moveCardStatus(
  id: string,
  next: CardStatus,
): { card: Card } | { error: "not_found" | "illegal_transition" } {
  const card = cardById(id)
  if (!card) return { error: "not_found" }
  if (!canTransition(card.status, next)) return { error: "illegal_transition" }
  card.status = next
  return { card }
}
