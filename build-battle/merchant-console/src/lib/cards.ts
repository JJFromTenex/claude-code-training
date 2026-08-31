import { CardCategory, CardStatus } from "@/data/types"

/**
 * Virtual card numbers and the card status machine.
 *
 * Every generated number starts with the 4242 test BIN and carries a valid
 * Luhn check digit, so nothing here can resemble a real PAN. Generation is
 * server-side only — a number produced in the browser is a bug — and the full
 * number is returned to its caller once and never stored.
 */

export const TEST_BIN = "4242"

const CARD_NUMBER_LENGTH = 16

/**
 * The Luhn check digit for a partial number, meaning everything except the
 * check digit itself. Doubling starts at the rightmost digit of the partial,
 * because the check digit will sit to its right.
 */
export function luhnCheckDigit(partial: string): number {
  let sum = 0
  let double = true
  for (let i = partial.length - 1; i >= 0; i--) {
    let digit = partial.charCodeAt(i) - 48
    if (double) {
      digit *= 2
      if (digit > 9) digit -= 9
    }
    double = !double
    sum += digit
  }
  return (10 - (sum % 10)) % 10
}

/** True when a complete number satisfies the Luhn checksum. */
export function isValidLuhn(value: string): boolean {
  if (!/^\d{2,}$/.test(value)) return false
  const partial = value.slice(0, -1)
  const check = value.charCodeAt(value.length - 1) - 48
  return luhnCheckDigit(partial) === check
}

/**
 * A full 16-digit number on the test BIN with a valid check digit.
 *
 * `random` is injectable so tests and the deterministic seed generator can
 * both produce stable numbers; production callers take the default.
 */
export function generateCardNumber(random: () => number = Math.random): string {
  const bodyLength = CARD_NUMBER_LENGTH - TEST_BIN.length - 1
  let body = ""
  for (let i = 0; i < bodyLength; i++) {
    body += Math.floor(random() * 10)
  }
  const partial = `${TEST_BIN}${body}`
  return `${partial}${luhnCheckDigit(partial)}`
}

/** The only card-number shape allowed outside a creation response. */
export function maskCardNumber(last4: string): string {
  return `•••• ${last4}`
}

export function lastFour(cardNumber: string): string {
  return cardNumber.slice(-4)
}

export const CARD_STATUSES = ["active", "frozen", "cancelled"] as const

export const CARD_CATEGORIES: readonly CardCategory[] = [
  "any",
  "advertising",
  "software",
  "travel",
  "office_supplies",
  "contractors",
]

/** One label map, so the dialog and the card detail cannot drift apart. */
export const CARD_CATEGORY_LABELS: Record<CardCategory, string> = {
  any: "Any category",
  advertising: "Advertising",
  software: "Software & subscriptions",
  travel: "Travel",
  office_supplies: "Office supplies",
  contractors: "Contractors",
}

/** `active ⇄ frozen`, either to `cancelled`, and `cancelled` is terminal. */
const TRANSITIONS: Record<CardStatus, readonly CardStatus[]> = {
  active: ["frozen", "cancelled"],
  frozen: ["active", "cancelled"],
  cancelled: [],
}

export function canTransition(from: CardStatus, to: CardStatus): boolean {
  return TRANSITIONS[from].includes(to)
}
