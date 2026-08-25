import { canTransition, generateCardNumber } from "@/lib/cards"
import { merchantById } from "./merchants"
import { store } from "./store"
import { Card, CardCategory, CardStatus, Currency } from "./types"

/** Card reads and the only two writes. Client input is allowlist-checked here, before the store. */

export const CARD_CURRENCIES: readonly Currency[] = ["USD", "EUR", "GBP"]
export const CARD_CATEGORIES: readonly CardCategory[] = [
  "advertising",
  "software",
  "travel",
  "contractors",
  "utilities",
]
export const CARD_STATUSES: readonly CardStatus[] = ["active", "frozen", "cancelled"]
/** Integer minor units. */
export const MAX_SPEND_LIMIT = 5_000_000

export const listCards = () =>
  [...store.cards].sort((a, b) => b.createdAt.localeCompare(a.createdAt))
export const cardById = (id: string) => store.cards.find((c) => c.id === id)

export interface IssueCardInput {
  nickname: string
  merchantId: string
  spendLimit: number
  currency: Currency
  category: CardCategory
}

/** Field → message safe to show an operator. */
export type FieldErrors = Partial<Record<keyof IssueCardInput, string>>

export function validateIssueCard(
  body: unknown,
): { input: IssueCardInput; errors?: undefined } | { errors: FieldErrors } {
  const raw = (body ?? {}) as Record<string, unknown>
  const errors: FieldErrors = {}

  const nickname = typeof raw.nickname === "string" ? raw.nickname.trim() : ""
  if (!nickname) errors.nickname = "Give the card a nickname ops will recognise."

  const merchant =
    typeof raw.merchantId === "string" ? merchantById(raw.merchantId) : undefined
  if (!raw.merchantId) errors.merchantId = "Choose a merchant."
  else if (!merchant) errors.merchantId = "That merchant does not exist."

  const spendLimit = raw.spendLimit
  if (typeof spendLimit !== "number" || !Number.isInteger(spendLimit)) {
    errors.spendLimit = "The spend limit must be a whole number of minor units."
  } else if (spendLimit <= 0) {
    errors.spendLimit = "The spend limit must be more than zero."
  } else if (spendLimit > MAX_SPEND_LIMIT) {
    errors.spendLimit = `The spend limit cannot exceed ${MAX_SPEND_LIMIT.toLocaleString("en-US")} minor units.`
  }

  const currency = raw.currency as Currency
  if (!CARD_CURRENCIES.includes(currency)) {
    errors.currency = "Currency must be one of USD, EUR, GBP."
  } else if (merchant && merchant.currency !== currency) {
    errors.currency = `${merchant.name} settles in ${merchant.currency}, so the card must be ${merchant.currency}.`
  }

  const category = raw.category as CardCategory
  if (!CARD_CATEGORIES.includes(category)) errors.category = "Choose a spend category."

  if (Object.keys(errors).length > 0) return { errors }
  return {
    input: { nickname, merchantId: merchant!.id, spendLimit: spendLimit as number, currency, category },
  }
}

/** The full number exists only in this return value; the record keeps last4 and a reference. A replayed key returns the card without one. */
export function issueCard(
  input: IssueCardInput,
  idempotencyKey?: string,
): { card: Card; cardNumber?: string; replayed: boolean } {
  const existing = idempotencyKey && cardById(store.cardIssues.get(idempotencyKey) ?? "")
  if (existing) return { card: existing, replayed: true }

  const cardNumber = generateCardNumber()
  const createdAt = new Date().toISOString()
  const card: Card = {
    id: `card_${String(store.cards.length + 1).padStart(4, "0")}`,
    ...input,
    reference: `ref_${crypto.randomUUID().slice(0, 8)}`,
    last4: cardNumber.slice(-4),
    spent: 0,
    status: "active",
    createdAt,
    events: [{ type: "issued", at: createdAt }],
  }
  store.cards.push(card)
  if (idempotencyKey) store.cardIssues.set(idempotencyKey, card.id)
  return { card, cardNumber, replayed: false }
}

/** Server-side guard for the state machine. Returns an error message or the card. */
export function transitionCard(
  card: Card,
  to: CardStatus,
): { card: Card; error?: undefined } | { error: string } {
  if (!canTransition(card.status, to)) {
    return {
      error:
        card.status === "cancelled"
          ? "A cancelled card cannot be changed."
          : `A ${card.status} card cannot be moved to ${to}.`,
    }
  }
  card.status = to
  card.events.push({ type: to === "active" ? "unfrozen" : to, at: new Date().toISOString() })
  return { card }
}
