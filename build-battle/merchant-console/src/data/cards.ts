import { canTransition, generateCardNumber, lastFourOf } from "@/lib/cards"
import { merchantById } from "./merchants"
import { store } from "./store"
import {
  Card,
  CardStatus,
  Currency,
  MerchantCategory,
  PaymentStatus,
} from "./types"

/**
 * Card reads and writes.
 *
 * Everything the client can send is checked here or in the route before it
 * reaches the store. The full card number is returned by `issueCard` once and
 * is never written to the record, so there is no field to leak it from later.
 */

/** The ticket's ceiling: 5,000,000 minor units. */
export const MAX_SPEND_LIMIT = 5_000_000

export const CURRENCIES: readonly Currency[] = ["USD", "EUR", "GBP"]

export const MERCHANT_CATEGORIES: readonly MerchantCategory[] = [
  "any",
  "advertising",
  "software",
  "travel",
  "contractors",
]

/** Spend counts captured payments only; authorized money has not moved yet. */
const SPENT_STATUSES: readonly PaymentStatus[] = ["captured"]

export function listCards(): Card[] {
  return [...store.cards].sort((a, b) => b.createdAt.localeCompare(a.createdAt))
}

export function cardById(id: string): Card | null {
  return store.cards.find((card) => card.id === id) ?? null
}

/**
 * Spend against a card, in the card's own currency and in minor units.
 *
 * There is no card_id on a payment in this codebase, so spend is attributed by
 * the card's merchant and currency, and only from the moment the card existed —
 * money moved before a card was issued cannot have moved on it. That is still
 * an approximation, and the detail page says so rather than presenting it as a
 * statement. Comparison is on UTC ISO strings, which sort lexically.
 */
export function spendForCard(card: Card): number {
  return store.payments
    .filter(
      (payment) =>
        payment.merchantId === card.merchantId &&
        payment.currency === card.currency &&
        SPENT_STATUSES.includes(payment.status) &&
        payment.createdAt >= card.createdAt,
    )
    .reduce((total, payment) => total + payment.amount, 0)
}

/**
 * Idempotency keys already used, mapped to the card they created.
 *
 * Ops double-clicking Issue, or a retried request, must not mint two cards.
 * Lives with the store, so it has the same lifetime as the data it guards.
 */
const issuedKeys = new Map<string, string>()

export interface IssueCardInput {
  nickname: string
  merchantId: string
  spendLimit: number
  currency: Currency
  categoryLock: MerchantCategory
}

/**
 * Create a card and return it alongside its full number.
 *
 * The number is generated here, on the server, and the caller is responsible
 * for returning it exactly once. Only the last four reaches the record.
 */
export function issueCard(input: IssueCardInput): {
  card: Card
  cardNumber: string
} {
  const cardNumber = generateCardNumber()
  const now = new Date().toISOString()
  const card: Card = {
    id: `card_${String(store.cards.length + 1).padStart(4, "0")}`,
    nickname: input.nickname,
    merchantId: input.merchantId,
    last4: lastFourOf(cardNumber),
    spendLimit: input.spendLimit,
    currency: input.currency,
    status: "active",
    categoryLock: input.categoryLock,
    createdAt: now,
    history: [{ from: null, to: "active", at: now }],
  }

  store.cards.push(card)
  return { card, cardNumber }
}

/**
 * Issue a card at most once per idempotency key.
 *
 * A replay returns the original card and no number: reveal-once outranks
 * returning a byte-identical response, so the caller is told it is a replay
 * rather than being handed the PAN a second time.
 */
export function issueCardOnce(
  input: IssueCardInput,
  key: string | null,
): { card: Card; cardNumber?: string; replayed: boolean } {
  if (key) {
    const existingId = issuedKeys.get(key)
    if (existingId) {
      const existing = cardById(existingId)
      if (existing) return { card: existing, replayed: true }
    }
  }

  const { card, cardNumber } = issueCard(input)
  if (key) issuedKeys.set(key, card.id)
  return { card, cardNumber, replayed: false }
}

/**
 * Move a card's status, refusing anything the machine does not allow.
 * Guarded here rather than only in the UI, so a stale tab cannot revive a
 * cancelled card.
 */
export function setCardStatus(
  id: string,
  next: CardStatus,
): { card: Card } | { error: string; status: number } {
  const card = cardById(id)
  if (!card) return { error: "Card not found.", status: 404 }

  if (!canTransition(card.status, next)) {
    return {
      error:
        card.status === "cancelled"
          ? "This card is cancelled and cannot change status."
          : `A card cannot go from ${card.status} to ${next}.`,
      status: 409,
    }
  }

  card.history.push({
    from: card.status,
    to: next,
    at: new Date().toISOString(),
  })
  card.status = next
  return { card }
}

/**
 * Validate an issue request. Returns the clean input or the first problem,
 * rejecting early rather than nesting.
 */
export function validateIssueInput(
  body: unknown,
): { input: IssueCardInput } | { error: string } {
  if (typeof body !== "object" || body === null) {
    return { error: "Expected a card to issue." }
  }

  const raw = body as Record<string, unknown>

  const nickname = typeof raw.nickname === "string" ? raw.nickname.trim() : ""
  if (!nickname) return { error: "Give the card a nickname." }
  if (nickname.length > 60) {
    return { error: "Nickname must be 60 characters or fewer." }
  }

  const merchantId = typeof raw.merchantId === "string" ? raw.merchantId : ""
  if (!merchantId) return { error: "Choose a merchant." }
  const merchant = merchantById(merchantId)
  if (!merchant) return { error: "Unknown merchant." }

  const currency = raw.currency as Currency
  if (!CURRENCIES.includes(currency)) {
    return { error: "Currency must be USD, EUR, or GBP." }
  }
  // A card that does not settle in the merchant's currency is the same class of
  // mistake as a wrong limit, so it is refused here rather than only warned
  // about in the dialog. The client cannot talk its way past this.
  if (currency !== merchant.currency) {
    return {
      error: `${merchant.name} settles in ${merchant.currency}, so this card cannot be ${currency}.`,
    }
  }

  const spendLimit = raw.spendLimit
  if (typeof spendLimit !== "number" || !Number.isInteger(spendLimit)) {
    return { error: "Spend limit must be a whole number of minor units." }
  }
  if (spendLimit <= 0) return { error: "Spend limit must be more than zero." }
  if (spendLimit > MAX_SPEND_LIMIT) {
    return { error: "Spend limit must be 5,000,000 minor units or less." }
  }

  const categoryLock = (raw.categoryLock ?? "any") as MerchantCategory
  if (!MERCHANT_CATEGORIES.includes(categoryLock)) {
    return { error: "Unknown category lock." }
  }

  return {
    input: { nickname, merchantId, spendLimit, currency, categoryLock },
  }
}
