import { randomInt } from "crypto"
import { CardCategory, CardStatus, Currency } from "@/data/types"

/**
 * Pure card domain logic: number generation (Luhn, test BIN only), the
 * status state machine, and spend-percentage math. No store access here.
 */

export const CARD_BIN = "4242"
export const CARD_NUMBER_LENGTH = 16
export const MAX_LIMIT_MINOR_UNITS = 5_000_000

export const ALLOWED_CURRENCIES: readonly Currency[] = ["USD", "EUR", "GBP"]

export const CARD_CATEGORIES: readonly CardCategory[] = [
  "software",
  "advertising",
  "travel",
  "office_supplies",
  "professional_services",
  "other",
]

/** Standard Luhn check digit for a partial number (digits right to left). */
export function luhnCheckDigit(partialNumber: string): number {
  let sum = 0
  const digits = partialNumber.split("").reverse()
  for (let i = 0; i < digits.length; i++) {
    let digit = Number(digits[i])
    // The check digit will be appended after this one, so the digit
    // immediately left of it (index 0 here) is doubled, then every
    // other digit going left from there (Luhn alternates).
    if (i % 2 === 0) {
      digit *= 2
      if (digit > 9) digit -= 9
    }
    sum += digit
  }
  return (10 - (sum % 10)) % 10
}

/** Validate a full card number's trailing digit is a correct Luhn check digit. */
export function isLuhnValid(fullNumber: string): boolean {
  return luhnCheckDigit(fullNumber.slice(0, -1)) === Number(fullNumber.slice(-1))
}

/** Generate a server-side test card number: 4242 BIN + random digits + Luhn check digit. */
export function generateCardNumber(): string {
  let partial = CARD_BIN
  while (partial.length < CARD_NUMBER_LENGTH - 1) {
    partial += String(randomInt(0, 10))
  }
  return partial + String(luhnCheckDigit(partial))
}

const TRANSITIONS: Record<CardStatus, CardStatus[]> = {
  active: ["frozen", "cancelled"],
  frozen: ["active", "cancelled"],
  cancelled: [],
}

/** Guards the card status state machine. A status "transitioning" to itself is invalid. */
export function canTransition(from: CardStatus, to: CardStatus): boolean {
  return TRANSITIONS[from].includes(to)
}

/**
 * Display ratio only (0-100, rounded, clamped). Not a stored/compared money
 * amount, so division here does not violate the integer-minor-units rule.
 */
export function spendPercentage(spent: number, limit: number): number {
  if (limit <= 0) return 0
  return Math.min(100, Math.round((spent / limit) * 100))
}

export function isNearLimit(spent: number, limit: number): boolean {
  return spendPercentage(spent, limit) >= 80
}
