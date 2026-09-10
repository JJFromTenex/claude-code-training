import { randomInt } from "node:crypto"

/**
 * Virtual card numbers. Server-side only: a number produced in the browser is
 * a bug. Every number starts with the 4242 test BIN, so nothing generated here
 * can ever resemble a real card.
 */

export const TEST_BIN = "4242"
export const CARD_NUMBER_LENGTH = 16

/** The Luhn check digit for a number that does not yet carry one. */
export function luhnCheckDigit(partial: string): string {
  let sum = 0
  for (let i = 0; i < partial.length; i++) {
    // Walking from the right, the digit next to the check digit is doubled.
    let digit = Number(partial[partial.length - 1 - i])
    if (i % 2 === 0) {
      digit *= 2
      if (digit > 9) digit -= 9
    }
    sum += digit
  }
  return String((10 - (sum % 10)) % 10)
}

/** True when the last digit is the correct Luhn check digit for the rest. */
export function isValidLuhn(number: string): boolean {
  if (!/^\d{2,}$/.test(number)) return false
  return luhnCheckDigit(number.slice(0, -1)) === number.slice(-1)
}

/**
 * A 16-digit number on the 4242 BIN with a valid check digit. The digit source
 * is injectable so tests can pin the output.
 */
export function generateTestCardNumber(
  randomDigit: () => number = () => randomInt(10),
): string {
  let body = TEST_BIN
  while (body.length < CARD_NUMBER_LENGTH - 1) body += String(randomDigit())
  return body + luhnCheckDigit(body)
}
