/**
 * Card number generation for virtual cards.
 *
 * Every number starts with the 4242 test BIN, so nothing generated here
 * can ever resemble a real card. Numbers are never persisted or displayed
 * in full after issue — only the last four and an opaque reference.
 */

const BIN = "4242"
const NUMBER_LENGTH = 16

/** Luhn check digit for a string of digits (without the check digit). */
export function luhnCheckDigit(digits: string): number {
  let sum = 0
  let double = true
  for (let i = digits.length - 1; i >= 0; i--) {
    let d = Number(digits[i])
    if (double) {
      d *= 2
      if (d > 9) d -= 9
    }
    sum += d
    double = !double
  }
  return (10 - (sum % 10)) % 10
}

export function luhnIsValid(number: string): boolean {
  if (!/^\d+$/.test(number)) return false
  const body = number.slice(0, -1)
  const check = Number(number.slice(-1))
  return luhnCheckDigit(body) === check
}

/** Generates a 16-digit number on the 4242 test BIN with a valid Luhn check digit. */
export function generateCardNumber(): string {
  let body = BIN
  for (let i = BIN.length; i < NUMBER_LENGTH - 1; i++) {
    body += Math.floor(Math.random() * 10)
  }
  return body + luhnCheckDigit(body)
}

export function last4Of(cardNumber: string): string {
  return cardNumber.slice(-4)
}

/** Everywhere but the one-time reveal, a card number renders like this. */
export function maskedNumber(last4: string): string {
  return `•••• ${last4}`
}
