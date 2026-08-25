import { generateCardNumber, last4Of } from "@/lib/luhn"
import { merchantById } from "./merchants"
import { store } from "./store"
import { Card, CardStatus, Currency, MerchantCategory } from "./types"

const CURRENCIES: readonly Currency[] = ["USD", "EUR", "GBP"]

/**
 * The one place category values and their display labels are declared.
 * The issue dialog and the card detail page both read this rather than
 * each keeping their own copy of the same five strings.
 */
export const CATEGORY_LABELS: Record<MerchantCategory, string> = {
  software: "Software",
  advertising: "Advertising",
  travel: "Travel",
  office_supplies: "Office supplies",
  other: "Other",
}

const CATEGORIES = Object.keys(CATEGORY_LABELS) as MerchantCategory[]

export const MAX_SPEND_LIMIT = 5_000_000

let cardSeq = 0
let refSeq = 0

export interface IssueCardInput {
  nickname: string
  merchantId: string
  spendLimit: number
  currency: Currency
  category: MerchantCategory
}

export interface IssueCardResult {
  card: Card
  /** The full generated number. Returned once, on issue, and never again. */
  number: string
}

/**
 * Dedupes a double-submitted issue request. Keyed on the client's
 * Idempotency-Key header; a replay returns the same card without ever
 * re-exposing the number that was already revealed once.
 */
const idempotencyKeys = new Map<string, string>()

export function issueCardIdempotent(
  input: IssueCardInput,
  idempotencyKey?: string | null,
): { card: Card; number: string | null } {
  if (idempotencyKey) {
    const existingId = idempotencyKeys.get(idempotencyKey)
    if (existingId) {
      const existing = cardById(existingId)
      if (existing) return { card: existing, number: null }
    }
  }

  const { card, number } = issueCard(input)
  if (idempotencyKey) idempotencyKeys.set(idempotencyKey, card.id)
  return { card, number }
}

/**
 * Server-side validation. The client is not trusted — every rule here is
 * re-checked regardless of what the form already enforced.
 */
export function validateIssueCard(input: Partial<IssueCardInput>): string[] {
  const errors: string[] = []

  if (!input.nickname || !input.nickname.trim()) {
    errors.push("Nickname is required.")
  }

  const merchant = input.merchantId ? merchantById(input.merchantId) : undefined
  if (!input.merchantId || !merchant) {
    errors.push("A valid merchant is required.")
  } else if (input.currency && merchant.currency !== input.currency) {
    errors.push(
      `${merchant.name} settles in ${merchant.currency}; a card for it must use ${merchant.currency}.`,
    )
  }

  if (
    typeof input.spendLimit !== "number" ||
    !Number.isFinite(input.spendLimit) ||
    !Number.isInteger(input.spendLimit)
  ) {
    errors.push("Spend limit must be an integer number of minor units.")
  } else if (input.spendLimit <= 0) {
    errors.push("Spend limit must be greater than zero.")
  } else if (input.spendLimit > MAX_SPEND_LIMIT) {
    errors.push(`Spend limit cannot exceed ${MAX_SPEND_LIMIT.toLocaleString()} minor units.`)
  }

  if (!input.currency || !CURRENCIES.includes(input.currency)) {
    errors.push("Currency must be one of USD, EUR, GBP.")
  }

  if (input.category && !CATEGORIES.includes(input.category)) {
    errors.push("Unrecognized merchant category.")
  }

  return errors
}

export function issueCard(input: IssueCardInput): IssueCardResult {
  const errors = validateIssueCard(input)
  if (errors.length > 0) {
    throw new Error(errors.join(" "))
  }

  const number = generateCardNumber()
  const createdAt = new Date().toISOString()
  const card: Card = {
    id: `card_${String(++cardSeq).padStart(6, "0")}`,
    nickname: input.nickname.trim(),
    merchantId: input.merchantId,
    spendLimit: input.spendLimit,
    spend: 0,
    currency: input.currency,
    status: "active",
    category: input.category ?? "other",
    last4: last4Of(number),
    numberRef: `ref_${String(++refSeq).padStart(6, "0")}`,
    createdAt,
    history: [{ status: "active", at: createdAt }],
  }

  store.cards.push(card)
  return { card, number }
}

export function listCards(): Card[] {
  return [...store.cards].sort((a, b) => b.createdAt.localeCompare(a.createdAt))
}

export function cardById(id: string): Card | null {
  return store.cards.find((c) => c.id === id) ?? null
}

/**
 * Status is a state machine: active <-> frozen, either can go to cancelled,
 * and cancelled is terminal. Anything else is rejected.
 */
const TRANSITIONS: Record<CardStatus, CardStatus[]> = {
  active: ["frozen", "cancelled"],
  frozen: ["active", "cancelled"],
  cancelled: [],
}

export function canTransition(from: CardStatus, to: CardStatus): boolean {
  return TRANSITIONS[from].includes(to)
}

export function transitionCard(id: string, to: CardStatus): Card {
  const card = cardById(id)
  if (!card) throw new Error("Card not found.")
  if (!canTransition(card.status, to)) {
    throw new Error(`Cannot move a ${card.status} card to ${to}.`)
  }
  card.status = to
  card.history.push({ status: to, at: new Date().toISOString() })
  return card
}
