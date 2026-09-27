import { CardStatus } from "@/data/types"

/**
 * Card number generation and the card status machine.
 *
 * Numbers are generated on the `4242` test BIN with a valid Luhn check digit,
 * so nothing in this repository can resemble a real PAN. Generation belongs to
 * the server: the full number exists in the issue response and nowhere else.
 */

export const TEST_BIN = "4242"
export const CARD_NUMBER_LENGTH = 16

/** The check digit that makes `partial` + digit satisfy Luhn. */
export function luhnCheckDigit(partial: string): number {
  let sum = 0
  // The check digit will sit to the right of `partial`, so the rightmost
  // digit of `partial` is the first one that doubles.
  let double = true
  for (let i = partial.length - 1; i >= 0; i--) {
    let digit = partial.charCodeAt(i) - 48
    if (double) {
      digit *= 2
      if (digit > 9) digit -= 9
    }
    sum += digit
    double = !double
  }
  return (10 - (sum % 10)) % 10
}

export function isLuhnValid(cardNumber: string): boolean {
  if (!/^\d+$/.test(cardNumber)) return false
  let sum = 0
  let double = false
  for (let i = cardNumber.length - 1; i >= 0; i--) {
    let digit = cardNumber.charCodeAt(i) - 48
    if (double) {
      digit *= 2
      if (digit > 9) digit -= 9
    }
    sum += digit
    double = !double
  }
  return sum % 10 === 0
}

function randomDigits(count: number): string {
  // Web Crypto: available in Node and the browser, so this module stays
  // bundler-safe for the components that only need masking.
  const bytes = new Uint8Array(count)
  crypto.getRandomValues(bytes)
  let out = ""
  for (const byte of bytes) out += String(byte % 10)
  return out
}

/** A 16-digit test-BIN number with a valid Luhn check digit. Server only. */
export function generateCardNumber(): string {
  const body = randomDigits(CARD_NUMBER_LENGTH - TEST_BIN.length - 1)
  const partial = `${TEST_BIN}${body}`
  return `${partial}${luhnCheckDigit(partial)}`
}

export function lastFour(cardNumber: string): string {
  return cardNumber.slice(-4)
}

/**
 * `active ⇄ frozen`, either to `cancelled`, and `cancelled` is terminal.
 * Guarded here so the server decides, not the UI.
 */
const CARD_TRANSITIONS: Record<CardStatus, readonly CardStatus[]> = {
  active: ["frozen", "cancelled"],
  frozen: ["active", "cancelled"],
  cancelled: [],
}

export function canTransition(from: CardStatus, to: CardStatus): boolean {
  return CARD_TRANSITIONS[from].includes(to)
}
