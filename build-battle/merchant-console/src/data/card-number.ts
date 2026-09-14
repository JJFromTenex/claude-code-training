/**
 * Card number generation. Server-side only: a number produced in the browser
 * is a bug. Every number starts with the 4242 test BIN and carries a valid
 * Luhn check digit, so nothing here can resemble a real PAN. The full number
 * is returned once, at issue; records keep the last four (see cards.ts).
 */

export const TEST_BIN = "4242"
export const CARD_NUMBER_LENGTH = 16

/** Luhn check digit for a string of digits (without the check digit). */
export function luhnCheckDigit(partial: string): string {
  if (!/^\d+$/.test(partial)) throw new Error("Luhn input must be digits")
  let sum = 0
  // Right to left; the digit immediately left of the check digit doubles.
  for (let i = partial.length - 1, double = true; i >= 0; i--, double = !double) {
    let digit = Number(partial[i])
    if (double && (digit *= 2) > 9) digit -= 9
    sum += digit
  }
  return String((10 - (sum % 10)) % 10)
}

/** True when the whole number, check digit included, passes Luhn. */
export function isLuhnValid(number: string): boolean {
  return /^\d{2,}$/.test(number) && luhnCheckDigit(number.slice(0, -1)) === number.slice(-1)
}

/** 16 digits on the test BIN with a valid check digit. `random` is injectable for tests. */
export function generateCardNumber(random: () => number = Math.random): string {
  let partial = TEST_BIN
  while (partial.length < CARD_NUMBER_LENGTH - 1) partial += Math.floor(random() * 10)
  return partial + luhnCheckDigit(partial)
}

export const lastFour = (number: string) => number.slice(-4)
