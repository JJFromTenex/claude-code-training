/**
 * Card numbers are generated server-side on the 4242 test BIN with a valid
 * Luhn check digit. Nothing here may resemble a real PAN, ever.
 */

const BIN = "4242"
const PAYLOAD_LENGTH = 15

/** The Luhn check digit that makes `payload + digit` pass the checksum. */
export function luhnCheckDigit(payload: string): number {
  let sum = 0
  for (let i = payload.length - 1, double = true; i >= 0; i--, double = !double) {
    let digit = Number(payload[i])
    if (double) {
      digit *= 2
      if (digit > 9) digit -= 9
    }
    sum += digit
  }
  return (10 - (sum % 10)) % 10
}

/** True if a full number's last digit satisfies the Luhn checksum. */
export function isValidLuhn(number: string): boolean {
  const payload = number.slice(0, -1)
  const checkDigit = Number(number.slice(-1))
  return luhnCheckDigit(payload) === checkDigit
}

/** A 16-digit `4242` test-BIN number with a valid Luhn check digit. Server-only. */
export function generateCardNumber(): string {
  let random = ""
  for (let i = 0; i < PAYLOAD_LENGTH - BIN.length; i++) {
    random += Math.floor(Math.random() * 10)
  }
  const payload = BIN + random
  return payload + luhnCheckDigit(payload)
}
