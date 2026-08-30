import { randomInt } from "crypto"
import { CardStatus } from "@/data/types"

/**
 * Card numbers are generated on the server, always on the 4242 test BIN, so
 * nothing here can ever resemble a real PAN. Status changes are a state
 * machine guarded here so a route can never move a card somewhere it
 * shouldn't be able to go.
 */

const TEST_BIN = "4242"
const RANDOM_DIGITS = 11

/**
 * Computes the Luhn check digit for a partial number (all digits except the
 * check digit itself). Doubling starts at the partial's rightmost digit,
 * since that digit becomes the second-from-the-right digit once the check
 * digit is appended.
 */
export function luhnCheckDigit(partial: string): number {
  let sum = 0
  let shouldDouble = true

  for (let i = partial.length - 1; i >= 0; i--) {
    let digit = Number(partial[i])
    if (shouldDouble) {
      digit *= 2
      if (digit > 9) digit -= 9
    }
    sum += digit
    shouldDouble = !shouldDouble
  }

  const remainder = sum % 10
  return remainder === 0 ? 0 : 10 - remainder
}

/** Standard Luhn check over a full digit string. */
export function isLuhnValid(number: string): boolean {
  if (!/^\d+$/.test(number)) return false

  let sum = 0
  let shouldDouble = false

  for (let i = number.length - 1; i >= 0; i--) {
    let digit = Number(number[i])
    if (shouldDouble) {
      digit *= 2
      if (digit > 9) digit -= 9
    }
    sum += digit
    shouldDouble = !shouldDouble
  }

  return sum % 10 === 0
}

/**
 * Generates a 16-digit card number on the 4242 test BIN with a valid Luhn
 * check digit. Server-side only — a number produced in the browser is a bug.
 */
export function generateCardNumber(): string {
  let middle = ""
  for (let i = 0; i < RANDOM_DIGITS; i++) {
    middle += randomInt(0, 10)
  }
  const partial = TEST_BIN + middle
  return partial + String(luhnCheckDigit(partial))
}

/** Renders only the last four digits, masking the rest with bullets. */
export function maskCard(last4: string): string {
  return `•••• ${last4}`
}

const ALLOWED_TRANSITIONS: Record<CardStatus, readonly CardStatus[]> = {
  active: ["frozen", "cancelled"],
  frozen: ["active", "cancelled"],
  cancelled: [],
}

/**
 * The card status state machine: active ⇄ frozen, either to cancelled, and
 * cancelled is terminal. No self-transitions.
 */
export function canTransition(from: CardStatus, to: CardStatus): boolean {
  return ALLOWED_TRANSITIONS[from].includes(to)
}
