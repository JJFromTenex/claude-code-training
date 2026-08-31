import { CardCategory, CardStatus, Currency } from "@/data/types"

/**
 * Card numbers. Test BIN only — every generated number starts 4242 and
 * carries a valid Luhn check digit. Generation happens here, server-side;
 * a number produced in the browser is a bug, per .claude/rules/cards.md.
 */

const TEST_BIN = "4242"
const CARD_NUMBER_LENGTH = 16

function luhnCheckDigit(partial: string): string {
  let sum = 0
  for (let i = 0; i < partial.length; i++) {
    let digit = Number(partial[partial.length - 1 - i])
    if (i % 2 === 0) {
      digit *= 2
      if (digit > 9) digit -= 9
    }
    sum += digit
  }
  return String((10 - (sum % 10)) % 10)
}

/** True if the number satisfies the Luhn checksum. */
export function isValidLuhn(number: string): boolean {
  let sum = 0
  for (let i = 0; i < number.length; i++) {
    let digit = Number(number[number.length - 1 - i])
    if (i % 2 === 1) {
      digit *= 2
      if (digit > 9) digit -= 9
    }
    sum += digit
  }
  return sum % 10 === 0
}

/** A fresh 16-digit test-BIN card number with a valid Luhn check digit. */
export function generateCardNumber(): string {
  const randomLength = CARD_NUMBER_LENGTH - TEST_BIN.length - 1
  let random = ""
  for (let i = 0; i < randomLength; i++) {
    random += String(Math.floor(Math.random() * 10))
  }
  const partial = TEST_BIN + random
  return partial + luhnCheckDigit(partial)
}

/** Reveal once, mask forever. */
export function maskNumber(last4: string): string {
  return `•••• ${last4}`
}

/**
 * Status is a state machine: active ⇄ frozen, either → cancelled, and
 * cancelled is terminal. Guard every transition through this, not just in
 * the UI — the route handler calls it too.
 */
const TRANSITIONS: Record<CardStatus, readonly CardStatus[]> = {
  active: ["frozen", "cancelled"],
  frozen: ["active", "cancelled"],
  cancelled: [],
}

export function canTransition(from: CardStatus, to: CardStatus): boolean {
  return TRANSITIONS[from].includes(to)
}

const CARD_STATUSES: readonly CardStatus[] = ["active", "frozen", "cancelled"]

export function isValidCardStatus(value: unknown): value is CardStatus {
  return (
    typeof value === "string" &&
    (CARD_STATUSES as readonly string[]).includes(value)
  )
}

/** Currencies a card can be issued in. Client input is checked against this, never trusted. */
export const CARD_CURRENCIES: readonly Currency[] = ["USD", "EUR", "GBP"]

/** Spend limits are integer minor units, capped at 5,000,000 (ticket rule). */
export const MAX_CARD_LIMIT_MINOR = 5_000_000

export function isValidCardCurrency(value: unknown): value is Currency {
  return (
    typeof value === "string" &&
    (CARD_CURRENCIES as readonly string[]).includes(value)
  )
}

export function isValidCardLimit(minor: unknown): minor is number {
  return (
    typeof minor === "number" &&
    Number.isInteger(minor) &&
    minor > 0 &&
    minor <= MAX_CARD_LIMIT_MINOR
  )
}

/** Spend against the limit, clamped to [0, 1]. */
export function spendRatio(spent: number, limit: number): number {
  if (limit <= 0) return 0
  return Math.min(1, Math.max(0, spent / limit))
}

/** Past this, the spend bar turns amber. */
export function isNearLimit(ratio: number): boolean {
  return ratio >= 0.8
}

/** Merchant categories a card can be locked to at issue time. Optional. */
export const CARD_CATEGORIES: readonly CardCategory[] = [
  "software",
  "advertising",
  "travel",
  "office_supplies",
  "other",
]

export const CARD_CATEGORY_LABELS: Record<CardCategory, string> = {
  software: "Software",
  advertising: "Advertising",
  travel: "Travel",
  office_supplies: "Office supplies",
  other: "Other",
}

export function isValidCardCategory(value: unknown): value is CardCategory {
  return (
    typeof value === "string" &&
    (CARD_CATEGORIES as readonly string[]).includes(value)
  )
}
