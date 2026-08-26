/**
 * Card numbers are generated server-side on the 4242 test BIN with a valid
 * Luhn check digit. Nothing here may resemble a real PAN, including in
 * tests and fixtures.
 */

const BIN = "4242"

/** Computes the Luhn check digit for a string of digits. */
export function luhnCheckDigit(partial: string): string {
  let sum = 0
  let double = true // rightmost of the existing digits doubles first
  for (let i = partial.length - 1; i >= 0; i--) {
    let digit = Number(partial[i])
    if (double) {
      digit *= 2
      if (digit > 9) digit -= 9
    }
    sum += digit
    double = !double
  }
  const checkDigit = (10 - (sum % 10)) % 10
  return String(checkDigit)
}

/** True if a string of digits passes the Luhn checksum. */
export function isValidLuhn(number: string): boolean {
  return luhnCheckDigit(number.slice(0, -1)) === number.slice(-1)
}

/** Generates a 16-digit card number on the 4242 test BIN with a valid Luhn check digit. */
export function generateCardNumber(): string {
  let body = BIN
  for (let i = 0; i < 11; i++) {
    body += String(Math.floor(Math.random() * 10))
  }
  return body + luhnCheckDigit(body)
}

/** Renders a masked card number from its last four digits. Never pass a full number here. */
export function maskCardNumber(last4: string): string {
  return `•••• ${last4}`
}
