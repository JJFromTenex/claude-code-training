import { CardCategory, CardStatus, Currency } from "@/data/types"

/**
 * Pure card logic: number generation, masking, and the status state machine.
 * No store import — this file is node-testable on its own.
 *
 * Card numbers use the 4242 test BIN with a valid Luhn check digit. Nothing
 * here may resemble a real PAN, including in tests and fixtures.
 */

export const CARD_BIN = "4242"
export const CARD_NUMBER_LENGTH = 16
export const MAX_SPEND_LIMIT_MINOR_UNITS = 5_000_000
export const NEAR_LIMIT_PERCENT = 80

export const CARD_CATEGORIES: readonly CardCategory[] = [
  "advertising",
  "software",
  "travel",
  "contractors",
  "utilities",
]

/** The server-side allowlist for card currency. */
export const CARD_CURRENCIES: readonly Currency[] = ["USD", "EUR", "GBP"]

/**
 * Computes the Luhn check digit for a string of digits that does not yet
 * include it. Doubles every digit that will land on an even position
 * counting from the right once the check digit is appended.
 */
export function luhnCheckDigit(digitsWithoutCheck: string): number {
  let sum = 0
  for (let i = 0; i < digitsWithoutCheck.length; i++) {
    let digit = Number(digitsWithoutCheck[digitsWithoutCheck.length - 1 - i])
    if (i % 2 === 0) {
      digit *= 2
      if (digit > 9) digit -= 9
    }
    sum += digit
  }
  return (10 - (sum % 10)) % 10
}

/** True when every digit of `cardNumber` (check digit included) satisfies Luhn. */
export function isValidLuhn(cardNumber: string): boolean {
  let sum = 0
  for (let i = 0; i < cardNumber.length; i++) {
    let digit = Number(cardNumber[cardNumber.length - 1 - i])
    if (i % 2 === 1) {
      digit *= 2
      if (digit > 9) digit -= 9
    }
    sum += digit
  }
  return sum % 10 === 0
}

/** CARD_BIN + 11 random digits + a Luhn check digit. Generate on the server only. */
export function generateCardNumber(): string {
  const randomDigitCount = CARD_NUMBER_LENGTH - CARD_BIN.length - 1
  let randomDigits = ""
  for (let i = 0; i < randomDigitCount; i++) {
    randomDigits += Math.floor(Math.random() * 10).toString()
  }
  const digitsWithoutCheck = CARD_BIN + randomDigits
  return digitsWithoutCheck + luhnCheckDigit(digitsWithoutCheck).toString()
}

/** "•••• 4242" — the only form a card number takes outside the creation response. */
export function maskCardNumber(last4: string): string {
  return `•••• ${last4}`
}

export const CARD_TRANSITIONS: Record<CardStatus, readonly CardStatus[]> = {
  active: ["frozen", "cancelled"],
  frozen: ["active", "cancelled"],
  cancelled: [],
}

export function canTransition(from: CardStatus, to: CardStatus): boolean {
  return CARD_TRANSITIONS[from].includes(to)
}

/** Integer math only: spent / spendLimit >= 80%, without ever dividing. */
export function isNearLimit(spent: number, spendLimit: number): boolean {
  return spent * 100 >= spendLimit * NEAR_LIMIT_PERCENT
}
