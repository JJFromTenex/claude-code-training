import { canTransition } from "@/lib/cards"
import { generateCardNumber } from "@/lib/luhn"
import { merchantById } from "./merchants"
import { store } from "./store"
import {
  CardCategory,
  CardStatus,
  Currency,
  VirtualCard,
} from "./types"

const VALID_CURRENCIES = new Set<string>(["USD", "EUR", "GBP"])
const VALID_CATEGORIES = new Set<string>([
  "advertising",
  "software",
  "travel",
  "supplies",
  "services",
  "other",
])
const MAX_LIMIT = 5_000_000

let cardSeq = 0

export interface IssueInput {
  nickname?: unknown
  merchantId?: unknown
  spendLimit?: unknown
  currency?: unknown
  category?: unknown
}

export interface IssueValidationError {
  message: string
}

export function validateIssueInput(
  input: IssueInput,
): IssueValidationError | null {
  if (typeof input.nickname !== "string" || input.nickname.trim() === "") {
    return { message: "Nickname is required." }
  }
  if (typeof input.merchantId !== "string" || input.merchantId.trim() === "") {
    return { message: "Merchant is required." }
  }
  const merchant = merchantById(input.merchantId)
  if (!merchant) {
    return { message: `Unknown merchant ${input.merchantId}.` }
  }
  if (typeof input.spendLimit !== "number") {
    return { message: "Spend limit must be a number." }
  }
  if (!Number.isInteger(input.spendLimit)) {
    return { message: "Spend limit must be a whole number of cents." }
  }
  if (input.spendLimit <= 0) {
    return { message: "Spend limit must be greater than zero." }
  }
  if (input.spendLimit > MAX_LIMIT) {
    return { message: "Spend limit exceeds the maximum." }
  }
  if (typeof input.currency !== "string" || !VALID_CURRENCIES.has(input.currency)) {
    return { message: `Unsupported currency ${input.currency}.` }
  }
  if (input.currency !== merchant.currency) {
    return {
      message: `Currency ${input.currency} does not match merchant ${merchant.name} (${merchant.currency}).`,
    }
  }
  if (
    input.category !== undefined &&
    input.category !== null &&
    (typeof input.category !== "string" || !VALID_CATEGORIES.has(input.category))
  ) {
    return { message: `Unsupported category ${input.category}.` }
  }
  return null
}

export function createCard(input: {
  nickname: string
  merchantId: string
  spendLimit: number
  currency: Currency
  category: CardCategory | null
  idempotencyKey?: string
}): { card: VirtualCard; fullNumber: string } {
  if (input.idempotencyKey) {
    const existingId = store.issuedKeys.get(input.idempotencyKey)
    if (existingId) {
      const existing = store.cards.find((c) => c.id === existingId)
      if (existing) {
        return { card: existing, fullNumber: "" }
      }
    }
  }

  const fullNumber = generateCardNumber()
  const last4 = fullNumber.slice(-4)
  cardSeq++
  const id = `card_${String(cardSeq).padStart(4, "0")}`
  const card: VirtualCard = {
    id,
    merchantId: input.merchantId,
    nickname: input.nickname.trim(),
    last4,
    spendLimit: input.spendLimit,
    currency: input.currency,
    status: "active",
    category: input.category,
    history: [],
    createdAt: new Date().toISOString(),
  }
  store.cards.push(card)

  if (input.idempotencyKey) {
    store.issuedKeys.set(input.idempotencyKey, id)
  }

  return { card, fullNumber }
}

export function transitionCard(
  cardId: string,
  to: CardStatus,
): { card: VirtualCard } | { error: string; status: number } {
  const card = store.cards.find((c) => c.id === cardId)
  if (!card) {
    return { error: "Card not found.", status: 404 }
  }
  if (!canTransition(card.status, to)) {
    return {
      error: `Cannot transition from ${card.status} to ${to}.`,
      status: 409,
    }
  }
  const from = card.status
  card.status = to
  card.history.push({ from, to, at: new Date().toISOString() })
  return { card }
}

export function cardSpend(card: VirtualCard): number {
  return store.payments
    .filter(
      (p) =>
        p.merchantId === card.merchantId &&
        p.status === "captured" &&
        p.createdAt >= card.createdAt,
    )
    .reduce((sum, p) => sum + p.amount, 0)
}
