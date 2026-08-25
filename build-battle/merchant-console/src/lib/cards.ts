/**
 * Card number generation and masking.
 *
 * Every number produced here starts with the 4242 test BIN, so nothing in this
 * repository can resemble a real PAN. Generation is server-side only: a number
 * produced in the browser is a bug, not a shortcut.
 */

/** The test BIN. Not optional, not configurable. */
export const TEST_BIN = "4242"

const CARD_NUMBER_LENGTH = 16

/**
 * The Luhn check digit for a body of digits, using the standard doubling from
 * the right. The body is everything but the check digit itself.
 */
export function luhnCheckDigit(digits: string): number {
  let sum = 0
  // The rightmost body digit is doubled, then every second one leftward.
  for (let i = digits.length - 1, position = 0; i >= 0; i--, position++) {
    let value = Number(digits[i])
    if (position % 2 === 0) {
      value *= 2
      if (value > 9) value -= 9
    }
    sum += value
  }
  return (10 - (sum % 10)) % 10
}

/** Whether a complete number carries the check digit Luhn expects. */
export function isLuhnValid(pan: string): boolean {
  if (!/^\d+$/.test(pan) || pan.length < 2) return false
  const body = pan.slice(0, -1)
  return luhnCheckDigit(body) === Number(pan.slice(-1))
}

/**
 * A 16-digit test card number: the 4242 BIN, eleven random digits, and the
 * Luhn check digit that makes the whole thing valid.
 */
export function generateCardNumber(): string {
  const randomLength = CARD_NUMBER_LENGTH - TEST_BIN.length - 1
  let body = TEST_BIN
  for (let i = 0; i < randomLength; i++) {
    body += String(Math.floor(Math.random() * 10))
  }
  return body + String(luhnCheckDigit(body))
}

/** The only rendering of a card number outside the creation response. */
export function maskCardNumber(last4: string): string {
  return `•••• ${last4}`
}

/** How many twentieths of the limit a spend bar fills. Zero to twenty. */
export function spendBarSteps(spent: number, limit: number): number {
  if (limit <= 0) return 0
  return Math.max(0, Math.min(20, Math.round((spent * 20) / limit)))
}

/**
 * Whether spend has passed eighty percent of the limit.
 *
 * Compared as integers: `spent * 5 > limit * 4` asks the same question as
 * `spent / limit > 0.8` without turning two minor-unit amounts into a float.
 */
export function isNearLimit(spent: number, limit: number): boolean {
  return limit > 0 && spent * 5 > limit * 4
}
