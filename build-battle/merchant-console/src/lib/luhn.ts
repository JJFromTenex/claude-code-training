/**
 * Test-BIN card number generation. Server-side only: this module is imported
 * from `src/data/` and `src/app/api/`, never from a "use client" component.
 * A card number produced in the browser is a bug per `.claude/rules/cards.md`.
 */

const TEST_BIN = "4242"
const CARD_NUMBER_LENGTH = 16

/**
 * Luhn check digit / validity. `digits` is the number with its check digit
 * still attached; doubling starts from the second-to-last digit and
 * alternates from there, per the standard algorithm.
 */
export function isValidLuhn(number: string): boolean {
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
 * Generates a 16-digit number starting with the `4242` test BIN and ending
 * in a valid Luhn check digit. Nothing produced here may resemble a real PAN.
 */
export function generateCardNumber(): string {
  const remainingLength = CARD_NUMBER_LENGTH - TEST_BIN.length - 1
  let body = TEST_BIN
  for (let i = 0; i < remainingLength; i++) {
    body += Math.floor(Math.random() * 10).toString()
  }

  const checkDigit = luhnCheckDigit(body)
  return body + checkDigit
}

/** Computes the check digit that makes `partialNumber + digit` Luhn-valid. */
function luhnCheckDigit(partialNumber: string): string {
  let sum = 0
  let shouldDouble = true // the check digit position doubles the digit before it first
  for (let i = partialNumber.length - 1; i >= 0; i--) {
    let digit = Number(partialNumber[i])
    if (shouldDouble) {
      digit *= 2
      if (digit > 9) digit -= 9
    }
    sum += digit
    shouldDouble = !shouldDouble
  }
  return String((10 - (sum % 10)) % 10)
}
