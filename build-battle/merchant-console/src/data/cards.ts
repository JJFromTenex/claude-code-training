import { generateCardNumber } from "@/lib/cards"
import { merchantById } from "./merchants"
import { store } from "./store"
import { Card, CardStatus, Currency, MerchantCategory } from "./types"

/**
 * Anything from the client is checked against an allowlist before it reaches
 * the store. Route handlers call this rather than reading the body themselves.
 */
export const CARD_CURRENCIES: readonly Currency[] = ["USD", "EUR", "GBP"]

export const CARD_STATUSES: readonly CardStatus[] = [
  "active",
  "frozen",
  "cancelled",
]

export function isCardStatus(value: unknown): value is CardStatus {
  return (
    typeof value === "string" &&
    (CARD_STATUSES as readonly string[]).includes(value)
  )
}

export const MAX_LIMIT_MINOR_UNITS = 5_000_000

/** Locked at issue time. Label pairs so the form and the allowlist agree. */
export const CARD_CATEGORIES: readonly {
  value: MerchantCategory
  label: string
}[] = [
  { value: "advertising", label: "Advertising" },
  { value: "software", label: "Software & SaaS" },
  { value: "travel", label: "Travel" },
  { value: "contractors", label: "Contractors" },
  { value: "office_supplies", label: "Office supplies" },
  { value: "other", label: "Other" },
]

export function isMerchantCategory(value: unknown): value is MerchantCategory {
  return (
    typeof value === "string" &&
    CARD_CATEGORIES.some((category) => category.value === value)
  )
}

interface IssueCardFields {
  nickname: string
  merchantId: string
  limit: number
  currency: Currency
  category: MerchantCategory | null
}

type ValidationResult =
  | { ok: true; value: IssueCardFields }
  | { ok: false; message: string }

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null
}

export function validateIssueCardInput(input: unknown): ValidationResult {
  if (!isRecord(input)) {
    return { ok: false, message: "Request body must be an object" }
  }

  const nickname =
    typeof input.nickname === "string" ? input.nickname.trim() : ""
  if (!nickname) {
    return { ok: false, message: "Nickname is required" }
  }

  const merchantId =
    typeof input.merchantId === "string" ? input.merchantId : ""
  if (!merchantId || !merchantById(merchantId)) {
    return { ok: false, message: "A valid merchant is required" }
  }

  const limit = typeof input.limit === "number" ? input.limit : NaN
  if (!Number.isInteger(limit) || limit <= 0) {
    return {
      ok: false,
      message: "Spend limit must be a positive whole number of minor units",
    }
  }
  if (limit > MAX_LIMIT_MINOR_UNITS) {
    return {
      ok: false,
      message: `Spend limit cannot exceed ${MAX_LIMIT_MINOR_UNITS} minor units`,
    }
  }

  const currency = typeof input.currency === "string" ? input.currency : ""
  if (!CARD_CURRENCIES.includes(currency as Currency)) {
    return { ok: false, message: "Currency must be USD, EUR, or GBP" }
  }

  // Optional: locks the card to a merchant category at issue time.
  const rawCategory = input.category
  if (rawCategory != null && !isMerchantCategory(rawCategory)) {
    return { ok: false, message: "Category must be one of the allowed values" }
  }
  const category = isMerchantCategory(rawCategory) ? rawCategory : null

  return {
    ok: true,
    value: {
      nickname,
      merchantId,
      limit,
      currency: currency as Currency,
      category,
    },
  }
}

const pad = (n: number, width = 6) => String(n).padStart(width, "0")

function nextCardId(): string {
  return `card_${pad(store.cards.length + 1)}`
}

type IssueCardResult =
  | { ok: true; card: Card; fullNumber: string }
  | { ok: false; message: string }

/**
 * Validates, generates the number on the server, and stores the card.
 * `fullNumber` is returned once here and never written onto the stored
 * `Card` — there is no field on the record that could leak it later.
 */
export function issueCard(input: unknown): IssueCardResult {
  const validation = validateIssueCardInput(input)
  if (!validation.ok) return validation

  const { nickname, merchantId, limit, currency, category } = validation.value
  const fullNumber = generateCardNumber()

  const card: Card = {
    id: nextCardId(),
    merchantId,
    nickname,
    last4: fullNumber.slice(-4),
    limit,
    currency,
    spent: 0,
    status: "active",
    category,
    createdAt: new Date().toISOString(),
  }

  store.cards.push(card)
  return { ok: true, card, fullNumber }
}

export function listCards(): Card[] {
  return store.cards
}

export function cardById(id: string): Card | null {
  return store.cards.find((card) => card.id === id) ?? null
}

/**
 * The state machine: active ⇄ frozen, either can go to cancelled, and
 * cancelled is terminal. Guarded here so the UI is never the enforcement.
 */
const ALLOWED_TRANSITIONS: Record<CardStatus, readonly CardStatus[]> = {
  active: ["frozen", "cancelled"],
  frozen: ["active", "cancelled"],
  cancelled: [],
}

type TransitionResult =
  | { ok: true; card: Card }
  | { ok: false; message: string }

export function transitionCardStatus(
  id: string,
  next: CardStatus,
): TransitionResult {
  const card = cardById(id)
  if (!card) return { ok: false, message: "Card not found" }

  if (!ALLOWED_TRANSITIONS[card.status].includes(next)) {
    return {
      ok: false,
      message: `Cannot move a ${card.status} card to ${next}`,
    }
  }

  card.status = next
  return { ok: true, card }
}
