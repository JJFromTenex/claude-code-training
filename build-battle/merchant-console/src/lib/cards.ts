import { CardStatus, Currency } from "@/data/types"

/**
 * Pure card logic: Luhn generation on the 4242 test BIN, masking, and the
 * status state machine. No store access, no imports beyond types.
 */

/** The only BIN in this repository. Nothing here may resemble a real PAN. */
export const TEST_BIN = "4242"

/** Total length of a generated number, including the check digit. */
export const CARD_NUMBER_LENGTH = 16

/** Minor units, exclusive of 0. */
export const MIN_SPEND_LIMIT = 1
/** Minor units, inclusive. */
export const MAX_SPEND_LIMIT = 5_000_000

export const CARD_CURRENCIES: readonly Currency[] = ["USD", "EUR", "GBP"]

/** True if `number` (digits only) carries a valid Luhn check digit. */
export function luhnCheck(number: string): boolean {
  // Without this guard "" and "   " pass: the loop never runs, sum stays 0,
  // and 0 % 10 === 0. A string with no digits carries no check digit.
  if (!/^\d+$/.test(number)) return false

  let sum = 0
  let double = false
  for (let i = number.length - 1; i >= 0; i--) {
    let digit = Number(number[i])
    if (double) {
      digit *= 2
      if (digit > 9) digit -= 9
    }
    sum += digit
    double = !double
  }
  return sum % 10 === 0
}

/** The check digit that makes `partial` (15 digits) Luhn-valid. */
export function luhnCheckDigit(partial: string): string {
  let sum = 0
  let double = true
  for (let i = partial.length - 1; i >= 0; i--) {
    let digit = Number(partial[i])
    if (double) {
      digit *= 2
      if (digit > 9) digit -= 9
    }
    sum += digit
    double = !double
  }
  const remainder = sum % 10
  return String(remainder === 0 ? 0 : 10 - remainder)
}

/**
 * A 16-digit number: TEST_BIN, then 11 random digits, then the Luhn check
 * digit. Server-only — calling this in the browser is a bug.
 */
export function generateCardNumber(): string {
  let middle = ""
  for (let i = 0; i < CARD_NUMBER_LENGTH - TEST_BIN.length - 1; i++) {
    middle += String(Math.floor(Math.random() * 10))
  }
  const partial = TEST_BIN + middle
  return partial + luhnCheckDigit(partial)
}

/** "•••• 4242" from a four-digit string. The only masking in the app. */
export function maskLast4(last4: string): string {
  return `•••• ${last4}`
}

/**
 * The state machine: active ⇄ frozen, either to cancelled, cancelled terminal.
 * A transition to the same status is false.
 */
export function canTransition(from: CardStatus, to: CardStatus): boolean {
  if (from === to) return false
  if (from === "cancelled") return false
  if (to === "cancelled") return true
  if (from === "active" && to === "frozen") return true
  if (from === "frozen" && to === "active") return true
  return false
}
