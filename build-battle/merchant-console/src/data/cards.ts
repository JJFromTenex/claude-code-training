import {
  canTransition,
  generateCardNumber,
  lastFour,
} from "@/lib/cards"
import { parseAmountToMinorUnits } from "@/lib/money"
import { merchantById } from "./merchants"
import { store } from "./store"
import { Card, CardStatus, Currency, MerchantCategory } from "./types"

/**
 * Card store access and the server-side validation behind it.
 *
 * Route handlers call into here rather than reading the store directly, so
 * the allowlists are in one place and are reachable from a test.
 */

export const CURRENCIES: readonly Currency[] = ["USD", "EUR", "GBP"]

export const CATEGORIES: readonly MerchantCategory[] = [
  "advertising",
  "software",
  "travel",
  "contractors",
  "office",
]

export const CARD_STATUSES: readonly CardStatus[] = [
  "active",
  "frozen",
  "cancelled",
]

/** A limit above this is rejected. Integer minor units, per the ticket. */
export const MAX_SPEND_LIMIT = 5_000_000

export const CATEGORY_LABELS: Record<MerchantCategory, string> = {
  advertising: "Advertising",
  software: "Software",
  travel: "Travel",
  contractors: "Contractors",
  office: "Office",
}

export function listCards(): Card[] {
  // Newest first, matching how the payments table reads.
  return [...store.cards].sort((a, b) => b.createdAt.localeCompare(a.createdAt))
}

export function cardById(id: string): Card | null {
  return store.cards.find((card) => card.id === id) ?? null
}

export interface CreateCardInput {
  nickname?: unknown
  merchantId?: unknown
  spendLimit?: unknown
  currency?: unknown
  category?: unknown
}

export interface ValidationFailure {
  field: string
  message: string
}

export type Validated<T> =
  | { ok: true; value: T }
  | { ok: false; error: ValidationFailure }

interface ValidCard {
  nickname: string
  merchantId: string
  spendLimit: number
  currency: Currency
  category: MerchantCategory | null
}

/**
 * Validate a creation payload against the allowlists. Rejects early and
 * returns, so no case hides inside a nested branch.
 *
 * `spendLimit` accepts either integer minor units (what the API contract says)
 * or a major-unit string like "250.00" from the form, converted once here at
 * the boundary via the existing money helper. Never a float.
 */
export function validateCreateCard(input: CreateCardInput): Validated<ValidCard> {
  const nickname =
    typeof input.nickname === "string" ? input.nickname.trim() : ""
  if (!nickname) {
    return {
      ok: false,
      error: { field: "nickname", message: "Give the card a nickname." },
    }
  }
  if (nickname.length > 60) {
    return {
      ok: false,
      error: { field: "nickname", message: "Nickname is too long (60 max)." },
    }
  }

  const merchantId =
    typeof input.merchantId === "string" ? input.merchantId.trim() : ""
  if (!merchantId) {
    return {
      ok: false,
      error: { field: "merchantId", message: "Pick a merchant." },
    }
  }
  if (!merchantById(merchantId)) {
    return {
      ok: false,
      error: { field: "merchantId", message: "That merchant does not exist." },
    }
  }

  const spendLimit = toMinorUnits(input.spendLimit)
  if (spendLimit === null) {
    return {
      ok: false,
      error: {
        field: "spendLimit",
        message: "Enter a spend limit as a whole number of minor units.",
      },
    }
  }
  if (spendLimit <= 0) {
    return {
      ok: false,
      error: {
        field: "spendLimit",
        message: "Spend limit must be greater than zero.",
      },
    }
  }
  if (spendLimit > MAX_SPEND_LIMIT) {
    return {
      ok: false,
      error: {
        field: "spendLimit",
        message: "Spend limit cannot exceed 5,000,000 minor units.",
      },
    }
  }

  const currency = input.currency
  if (!isCurrency(currency)) {
    return {
      ok: false,
      error: {
        field: "currency",
        message: "Currency must be one of USD, EUR, GBP.",
      },
    }
  }

  let category: MerchantCategory | null = null
  if (input.category !== undefined && input.category !== null && input.category !== "") {
    if (!isCategory(input.category)) {
      return {
        ok: false,
        error: { field: "category", message: "That category is not allowed." },
      }
    }
    category = input.category
  }

  return {
    ok: true,
    value: { nickname, merchantId, spendLimit, currency, category },
  }
}

/**
 * Create the card. Returns the record **and** the full number separately: the
 * number is a property of this one response and is never written to the store.
 */
export function createCard(input: ValidCard): { card: Card; fullNumber: string } {
  const pan = generateCardNumber()
  const card: Card = {
    id: `card_${String(store.cards.length + 1).padStart(4, "0")}_${Date.now().toString(36)}`,
    nickname: input.nickname,
    merchantId: input.merchantId,
    spendLimit: input.spendLimit,
    spend: 0,
    currency: input.currency,
    status: "active",
    last4: lastFour(pan),
    reference: `cref_${Math.random().toString(36).slice(2, 10)}`,
    category: input.category,
    createdAt: new Date().toISOString(),
  }
  store.cards.push(card)
  return { card, fullNumber: pan }
}

export type TransitionResult =
  | { ok: true; card: Card }
  | { ok: false; status: 404 | 400 | 409; message: string }

/**
 * Move a card's status. The state machine is enforced here, on the server,
 * so a curl cannot resurrect a cancelled card even though the UI hides the
 * button.
 */
export function transitionCard(id: string, to: unknown): TransitionResult {
  const card = cardById(id)
  if (!card) return { ok: false, status: 404, message: "Card not found." }

  if (!isCardStatus(to)) {
    return { ok: false, status: 400, message: "Unknown card status." }
  }

  if (!canTransition(card.status, to)) {
    const reason =
      card.status === "cancelled"
        ? "A cancelled card is permanent and cannot change status."
        : `A ${card.status} card cannot move to ${to}.`
    return { ok: false, status: 409, message: reason }
  }

  card.status = to
  return { ok: true, card }
}

function toMinorUnits(value: unknown): number | null {
  if (typeof value === "number") {
    return Number.isInteger(value) ? value : null
  }
  if (typeof value === "string") {
    const trimmed = value.trim()
    if (!trimmed) return null
    // Whole-number strings are already minor units; decimals are major units
    // from the form and get converted once, here, by the existing helper.
    if (/^-?\d+$/.test(trimmed)) return Number(trimmed)
    return parseAmountToMinorUnits(trimmed)
  }
  return null
}

function isCurrency(value: unknown): value is Currency {
  return typeof value === "string" && CURRENCIES.includes(value as Currency)
}

function isCategory(value: unknown): value is MerchantCategory {
  return (
    typeof value === "string" && CATEGORIES.includes(value as MerchantCategory)
  )
}

function isCardStatus(value: unknown): value is CardStatus {
  return typeof value === "string" && CARD_STATUSES.includes(value as CardStatus)
}
