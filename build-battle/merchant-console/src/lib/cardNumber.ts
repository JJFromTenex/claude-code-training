/**
 * Card numbers are generated on the server, on the 4242 test BIN, with a
 * valid Luhn check digit. Nothing here may resemble a real PAN.
 */

const BIN = "4242"
const DIGIT_COUNT = 16

/** Always "•••• 4242" — the BIN, not any individual card's own digits. */
export const MASKED_CARD_NUMBER = "•••• 4242"

/**
 * The standard Luhn check digit for a 15-digit payload.
 * From the rightmost digit leftward, double every digit at an odd distance
 * from the right; digits that double past 9 lose 9. Sum everything, then
 * the check digit is whatever brings that sum to a multiple of 10.
 */
export function luhnCheckDigit(payload: string): string {
  let sum = 0
  for (let i = 0; i < payload.length; i++) {
    const distanceFromRight = payload.length - i
    let digit = Number(payload[i])
    if (distanceFromRight % 2 === 1) {
      digit *= 2
      if (digit > 9) digit -= 9
    }
    sum += digit
  }
  return String((10 - (sum % 10)) % 10)
}

/** True if a full number's last digit is a valid Luhn check digit for the rest. */
export function isLuhnValid(fullNumber: string): boolean {
  const payload = fullNumber.slice(0, -1)
  const checkDigit = fullNumber.slice(-1)
  return luhnCheckDigit(payload) === checkDigit
}

/** Generates a 16-digit test card number: the 4242 BIN, random digits, a Luhn check digit. */
export function generateCardNumber(): string {
  const randomDigitCount = DIGIT_COUNT - BIN.length - 1
  let payload = BIN
  for (let i = 0; i < randomDigitCount; i++) {
    payload += Math.floor(Math.random() * 10)
  }
  return payload + luhnCheckDigit(payload)
}
