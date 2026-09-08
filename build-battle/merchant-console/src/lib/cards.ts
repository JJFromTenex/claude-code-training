import { CardCategory, CardStatus } from "@/data/types"

/**
 * Card primitives: number generation on the test BIN, masking, and the status
 * state machine. Pure on purpose — nothing here reads the store, so the rules
 * that actually matter can be tested without booting one.
 */

/** The test BIN. Nothing generated in this repository may resemble a real PAN. */
const CARD_BIN = "4242"

/** Ceiling on a spend limit, in integer minor units. */
export const MAX_SPEND_LIMIT_MINOR = 5_000_000

export const CARD_CATEGORIES: readonly CardCategory[] = [
  "advertising",
  "software",
  "shipping",
  "travel",
  "office",
  "contractors",
]

/**
 * The Luhn digit that completes `partial`. Doubling starts at the partial's
 * last digit, because the returned digit takes the position after it.
 */
function luhnCheckDigit(partial: string): string {
  let sum = 0
  for (let i = partial.length - 1; i >= 0; i--) {
    const fromRight = partial.length - 1 - i
    let digit = Number(partial[i])
    if (fromRight % 2 === 0) {
      digit *= 2
      if (digit > 9) digit -= 9
    }
    sum += digit
  }
  return String((10 - (sum % 10)) % 10)
}

export function isLuhnValid(cardNumber: string): boolean {
  if (!/^\d+$/.test(cardNumber)) return false

  let sum = 0
  for (let i = cardNumber.length - 1; i >= 0; i--) {
    const fromRight = cardNumber.length - 1 - i
    let digit = Number(cardNumber[i])
    if (fromRight % 2 === 1) {
      digit *= 2
      if (digit > 9) digit -= 9
    }
    sum += digit
  }
  return sum % 10 === 0
}

/**
 * A 16-digit number on the test BIN carrying a valid check digit. Only server
 * code calls this — the create path in `src/data/cards.ts`. Client components
 * import constants and helpers from this module, never this function: a number
 * produced in the browser is a bug.
 */
export function generateCardNumber(): string {
  let body = CARD_BIN
  while (body.length < 15) body += String(Math.floor(Math.random() * 10))
  return body + luhnCheckDigit(body)
}

/** How a card reads everywhere except the one creation response. U+2022 bullets. */
export function maskCard(last4: string): string {
  return `•••• ${last4}`
}

/**
 * active to frozen and back, either to cancelled, and cancelled is terminal.
 * A card never transitions to the status it already holds.
 */
const TRANSITIONS: Record<CardStatus, readonly CardStatus[]> = {
  active: ["frozen", "cancelled"],
  frozen: ["active", "cancelled"],
  cancelled: [],
}

export function canTransition(from: CardStatus, to: CardStatus): boolean {
  return TRANSITIONS[from].includes(to)
}
