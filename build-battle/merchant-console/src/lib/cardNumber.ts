/**
 * Card numbers, server-side only. Every generated number starts with the
 * 4242 test BIN and carries a valid Luhn check digit, so nothing produced
 * here can resemble a real PAN.
 */

const BIN = "4242"
const LENGTH = 16

function luhnCheckDigit(partial: string): string {
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
  return String((10 - (sum % 10)) % 10)
}

/** True if the full number (any length) satisfies the Luhn checksum. */
export function isValidLuhn(number: string): boolean {
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

/** Generates a 16-digit number on the 4242 BIN with a valid Luhn check digit. */
export function generateCardNumber(): string {
  let middle = ""
  for (let i = 0; i < LENGTH - BIN.length - 1; i++) {
    middle += String(Math.floor(Math.random() * 10))
  }
  const partial = BIN + middle
  return partial + luhnCheckDigit(partial)
}

export function last4(cardNumber: string): string {
  return cardNumber.slice(-4)
}
