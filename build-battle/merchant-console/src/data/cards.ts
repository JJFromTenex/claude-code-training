import { generateCardNumber, isValidCardTransition } from "@/lib/cards"
import { parseAmountToMinorUnits } from "@/lib/money"
import { merchantById } from "./merchants"
import { store } from "./store"
import { Card, CardCategory, CardStatus, Currency } from "./types"

/**
 * The one place cards are read or mutated. Route handlers call these
 * rather than touching `store.cards` themselves — same shape as
 * `src/data/queries.ts` for payments.
 */

export const SPEND_LIMIT_MAX_MINOR_UNITS = 5_000_000

const ALLOWED_CURRENCIES: readonly Currency[] = ["USD", "EUR", "GBP"]
const ALLOWED_CATEGORIES: readonly CardCategory[] = [
  "vendor_subscriptions",
  "ad_spend",
  "contractor_tools",
]

const pad = (n: number) => String(n).padStart(4, "0")

export function listCards(): Card[] {
  return [...store.cards].sort((a, b) => b.createdAt.localeCompare(a.createdAt))
}

export function cardById(id: string): Card | null {
  return store.cards.find((c) => c.id === id) ?? null
}

export interface IssueCardInput {
  nickname: unknown
  merchantId: unknown
  /** Raw client string — parsed at this boundary, once. */
  limit: unknown
  currency: unknown
  category: unknown
}

export type IssueCardResult =
  | { ok: true; card: Card; number: string }
  | { ok: false; error: string }

/**
 * Validates and issues a card. Every rejection names the actual problem —
 * "reject early and return" per `.claude/rules/api-routes.md`. The full
 * number exists only in this function's return value; `card` never
 * carries it.
 */
export function issueCard(input: IssueCardInput): IssueCardResult {
  const nickname =
    typeof input.nickname === "string" ? input.nickname.trim() : ""
  if (!nickname) {
    return { ok: false, error: "Give the card a nickname." }
  }

  const merchant =
    typeof input.merchantId === "string" ? merchantById(input.merchantId) : undefined
  if (!merchant) {
    return { ok: false, error: "Select a merchant to issue this card to." }
  }

  const limit =
    typeof input.limit === "string" ? parseAmountToMinorUnits(input.limit) : null
  if (limit === null || limit <= 0) {
    return { ok: false, error: "Enter a spend limit greater than $0.00." }
  }
  if (limit > SPEND_LIMIT_MAX_MINOR_UNITS) {
    return {
      ok: false,
      error: "Spend limit can't exceed 5,000,000 minor units (50,000.00).",
    }
  }

  if (
    typeof input.currency !== "string" ||
    !ALLOWED_CURRENCIES.includes(input.currency as Currency)
  ) {
    return { ok: false, error: "Choose USD, EUR, or GBP." }
  }
  if (input.currency !== merchant.currency) {
    return {
      ok: false,
      error: `${merchant.name} settles in ${merchant.currency} — issue the card in that currency.`,
    }
  }

  if (
    typeof input.category !== "string" ||
    !ALLOWED_CATEGORIES.includes(input.category as CardCategory)
  ) {
    return { ok: false, error: "Choose a spend category." }
  }

  const { number, last4 } = generateCardNumber()
  const now = new Date().toISOString()
  const card: Card = {
    id: `card_${pad(store.cards.length + 1)}`,
    nickname,
    merchantId: merchant.id,
    last4,
    limit,
    spent: 0,
    currency: merchant.currency,
    category: input.category as CardCategory,
    status: "active",
    createdAt: now,
    history: [{ status: "active", at: now }],
  }
  store.cards.push(card)

  return { ok: true, card, number }
}

export type SetCardStatusResult =
  | { ok: true; card: Card }
  | { ok: false; status: 404 | 400; error: string }

export function setCardStatus(id: string, next: CardStatus): SetCardStatusResult {
  const card = cardById(id)
  if (!card) {
    return { ok: false, status: 404, error: "Card not found." }
  }
  if (!isValidCardTransition(card.status, next)) {
    return {
      ok: false,
      status: 400,
      error: `Can't move a ${card.status} card to ${next}.`,
    }
  }
  card.status = next
  card.history.push({ status: next, at: new Date().toISOString() })
  return { ok: true, card }
}
