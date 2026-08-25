import { CardCategory, CardStatus, Currency } from "@/data/types"

/**
 * Virtual card rules: number generation, masking, and the status machine.
 *
 * Pure on purpose — nothing here touches the store, so the generator and the
 * transitions can be tested without booting an app. Numbers are generated on
 * the server only; a number produced in the browser is a bug.
 */

/** The test BIN. Every generated number starts with it, so nothing here can resemble a real PAN. */
export const TEST_BIN = "4242"

const CARD_NUMBER_LENGTH = 16

/** Spend limits are integer minor units. 5,000,000 is $50,000.00. */
export const MAX_SPEND_LIMIT = 5_000_000

export const CARD_CURRENCIES: readonly Currency[] = ["USD", "EUR", "GBP"]

export const CARD_CATEGORIES: readonly CardCategory[] = [
  "advertising",
  "software",
  "contractors",
  "travel",
  "other",
]

/**
 * The Luhn check digit for a payload, which becomes the number's last digit.
 * Doubling starts at the rightmost payload digit, because the check digit
 * will sit to its right.
 */
export function luhnCheckDigit(payload: string): string {
  let sum = 0
  let double = true

  for (let i = payload.length - 1; i >= 0; i--) {
    let digit = Number(payload[i])
    if (double) {
      digit *= 2
      if (digit > 9) digit -= 9
    }
    sum += digit
    double = !double
  }

  return String((10 - (sum % 10)) % 10)
}

/** True when a complete number satisfies Luhn. */
export function isValidLuhn(cardNumber: string): boolean {
  if (!/^\d+$/.test(cardNumber)) return false

  let sum = 0
  let double = false

  for (let i = cardNumber.length - 1; i >= 0; i--) {
    let digit = Number(cardNumber[i])
    if (double) {
      digit *= 2
      if (digit > 9) digit -= 9
    }
    sum += digit
    double = !double
  }

  return sum % 10 === 0
}

/**
 * A 16-digit number on the test BIN with a valid check digit.
 * Server-side only. The result is returned once and never stored.
 */
export function generateCardNumber(): string {
  const body = Array.from({ length: CARD_NUMBER_LENGTH - TEST_BIN.length - 1 }, () =>
    String(Math.floor(Math.random() * 10)),
  ).join("")

  const payload = `${TEST_BIN}${body}`
  return `${payload}${luhnCheckDigit(payload)}`
}

/** How a card number is written anywhere other than the creation response. */
export function maskCardNumber(last4: string): string {
  return `•••• ${last4}`
}

/** Groups a full number for the one screen that is allowed to show it. */
export function formatCardNumber(cardNumber: string): string {
  return cardNumber.replace(/(.{4})/g, "$1 ").trim()
}

/** active ⇄ frozen, either to cancelled, and cancelled is terminal. */
export const CARD_TRANSITIONS: Record<CardStatus, readonly CardStatus[]> = {
  active: ["frozen", "cancelled"],
  frozen: ["active", "cancelled"],
  cancelled: [],
}

export function canTransition(from: CardStatus, to: CardStatus): boolean {
  return CARD_TRANSITIONS[from].includes(to)
}

export function isCardStatus(value: unknown): value is CardStatus {
  return value === "active" || value === "frozen" || value === "cancelled"
}
