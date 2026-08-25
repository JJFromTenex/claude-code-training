import { merchantById } from "@/data/merchants"
import { Card, CardCategory, CardStatus, Currency } from "@/data/types"
import { parseAmountToMinorUnits } from "./money"

/**
 * Card numbers, masking, status transitions, and input validation.
 *
 * Pure and server-side only. A card number produced in the browser is a bug
 * (`.claude/rules/cards.md`), so nothing here reaches into the store or a
 * request — callers in `src/data/queries.ts` do that.
 */

export const CARD_BIN = "4242"
const CARD_NUMBER_LENGTH = 16

export const CARD_STATUSES: readonly CardStatus[] = [
  "active",
  "frozen",
  "cancelled",
]

export const CARD_CURRENCIES: readonly Currency[] = ["USD", "EUR", "GBP"]

export const CARD_CATEGORIES: readonly CardCategory[] = [
  "advertising",
  "software",
  "travel",
  "contractors",
  "utilities",
]

export const CATEGORY_LABELS: Record<CardCategory, string> = {
  advertising: "Advertising",
  software: "Software",
  travel: "Travel",
  contractors: "Contractors",
  utilities: "Utilities",
}

/** Ticket cap: a limit above 5,000,000 minor units is rejected. */
export const MAX_SPEND_LIMIT_MINOR = 5_000_000

/** Luhn check digit for a string of digits (the number without its check digit). */
export function luhnCheckDigit(digits: string): number {
  let sum = 0
  // Walking right to left, every second digit (starting with the rightmost
  // of the *input*) is doubled — since a check digit is being appended,
  // that means every digit at an even index from the right here.
  for (let i = 0; i < digits.length; i++) {
    let d = Number(digits[digits.length - 1 - i])
    if (i % 2 === 0) {
      d *= 2
      if (d > 9) d -= 9
    }
    sum += d
  }
  return (10 - (sum % 10)) % 10
}

/** True if a full digit string is Luhn-valid (its own check digit included). */
export function isValidLuhn(number: string): boolean {
  if (!/^\d+$/.test(number)) return false
  const body = number.slice(0, -1)
  const check = Number(number[number.length - 1])
  return luhnCheckDigit(body) === check
}

/**
 * Generates a 16-digit card number on the `4242` test BIN with a valid Luhn
 * check digit. `random` is injectable so tests can seed it deterministically.
 */
export function generateCardNumber(random: () => number = Math.random): string {
  const bodyLength = CARD_NUMBER_LENGTH - CARD_BIN.length - 1
  let body = CARD_BIN
  for (let i = 0; i < bodyLength; i++) {
    body += Math.floor(random() * 10).toString()
  }
  return body + luhnCheckDigit(body).toString()
}

/** The one masking helper. Everywhere but the creation response, this is the number. */
export function maskLast4(last4: string): string {
  return `•••• ${last4}`
}

const ALLOWED_TRANSITIONS: Record<CardStatus, readonly CardStatus[]> = {
  active: ["frozen", "cancelled"],
  frozen: ["active", "cancelled"],
  cancelled: [],
}

/** `active ⇄ frozen`, either to `cancelled`, and `cancelled` is terminal. */
export function canTransition(from: CardStatus, to: CardStatus): boolean {
  return ALLOWED_TRANSITIONS[from].includes(to)
}

export interface CardInput {
  nickname: string
  merchantId: string
  /** Minor units as a number, or a decimal string like the money boundary parser accepts. */
  spendLimit: number | string
  currency: string
  category: string
}

export interface ValidCardInput {
  nickname: string
  merchantId: string
  spendLimit: number
  currency: Currency
  category: CardCategory
}

export type ValidationResult =
  | { ok: true; value: ValidCardInput }
  | { ok: false; error: string }

/**
 * Server-side validation against an allowlist. The client is not trusted
 * (`.claude/rules/api-routes.md`): everything here is re-checked no matter
 * what the form already enforced.
 */
export function validateCardInput(input: Partial<CardInput>): ValidationResult {
  const nickname = typeof input.nickname === "string" ? input.nickname.trim() : ""
  if (!nickname) {
    return { ok: false, error: "Nickname is required." }
  }

  const merchant = input.merchantId ? merchantById(input.merchantId) : null
  if (!input.merchantId || !merchant) {
    return { ok: false, error: "Choose a valid merchant." }
  }

  const limit =
    typeof input.spendLimit === "number"
      ? input.spendLimit
      : typeof input.spendLimit === "string"
        ? parseAmountToMinorUnits(input.spendLimit)
        : null

  if (limit === null || !Number.isInteger(limit) || limit <= 0) {
    return { ok: false, error: "Spend limit must be a positive amount." }
  }
  if (limit > MAX_SPEND_LIMIT_MINOR) {
    return {
      ok: false,
      error: "Spend limit cannot exceed 5,000,000 minor units.",
    }
  }

  if (!CARD_CURRENCIES.includes(input.currency as Currency)) {
    return { ok: false, error: "Currency must be USD, EUR, or GBP." }
  }

  // A card spends on the merchant's account, so its currency has to be the
  // merchant's currency — a USD card against a EUR merchant is meaningless.
  if (input.currency !== merchant.currency) {
    return {
      ok: false,
      error: `Currency must match ${merchant.name}'s currency (${merchant.currency}).`,
    }
  }

  if (!CARD_CATEGORIES.includes(input.category as CardCategory)) {
    return { ok: false, error: "Choose a valid merchant category." }
  }

  return {
    ok: true,
    value: {
      nickname,
      merchantId: input.merchantId,
      spendLimit: limit,
      currency: input.currency as Currency,
      category: input.category as CardCategory,
    },
  }
}

/** Spend as a fraction of the limit, clamped to [0, 1]. Display only. */
export function spendFraction(card: Pick<Card, "spent" | "spendLimit">): number {
  if (card.spendLimit <= 0) return 0
  return Math.min(1, Math.max(0, card.spent / card.spendLimit))
}
