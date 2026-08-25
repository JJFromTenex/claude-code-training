import { CardCategory, CardStatus } from "@/data/types"

/**
 * Card number generation and lifecycle rules.
 *
 * Every number this module produces starts with the 4242 test BIN and ends
 * with a valid Luhn check digit, so nothing in this repository can resemble
 * a real PAN. Generation happens on the server only; a number produced in
 * the browser is a bug (.claude/rules/cards.md).
 */

export const TEST_BIN = "4242"
export const CARD_NUMBER_LENGTH = 16

/** Ticket NWP-201: spend limits above 5,000,000 minor units are rejected. */
export const SPEND_LIMIT_CEILING = 5_000_000

/** The allowlist for the optional merchant category lock. */
export const CARD_CATEGORIES: readonly CardCategory[] = [
  "ads",
  "saas",
  "travel",
  "office",
  "other",
]

/**
 * Luhn check digit for a partial number (every digit except the last).
 * Walking right to left over the partial, every digit lands in a doubled
 * position once the check digit is appended.
 */
export function luhnCheckDigit(partial: string): number {
  let sum = 0
  for (let i = 0; i < partial.length; i++) {
    let digit = Number(partial[partial.length - 1 - i])
    if (i % 2 === 0) {
      digit *= 2
      if (digit > 9) digit -= 9
    }
    sum += digit
  }
  return (10 - (sum % 10)) % 10
}

/** True when the number is all digits and its Luhn checksum holds. */
export function isLuhnValid(cardNumber: string): boolean {
  if (!/^\d{2,}$/.test(cardNumber)) return false
  const partial = cardNumber.slice(0, -1)
  return luhnCheckDigit(partial) === Number(cardNumber[cardNumber.length - 1])
}

/** Generate a 16-digit number on the test BIN with a valid check digit. */
export function generateCardNumber(): string {
  let partial = TEST_BIN
  while (partial.length < CARD_NUMBER_LENGTH - 1) {
    partial += Math.floor(Math.random() * 10)
  }
  return partial + luhnCheckDigit(partial)
}

/** The only rendering a stored card number ever gets: mask plus last four. */
export function maskCard(last4: string): string {
  return `•••• ${last4}`
}

/**
 * The status state machine: active ⇄ frozen, either to cancelled, and
 * cancelled is terminal. Guarded here so the server enforces it no matter
 * what the UI offers.
 */
const TRANSITIONS: Record<CardStatus, readonly CardStatus[]> = {
  active: ["frozen", "cancelled"],
  frozen: ["active", "cancelled"],
  cancelled: [],
}

export function canTransitionCard(from: CardStatus, to: CardStatus): boolean {
  return TRANSITIONS[from].includes(to)
}
