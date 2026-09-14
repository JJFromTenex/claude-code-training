import { CardCategory, CardStatus } from "@/data/types"

/**
 * Card numbers, masking, and the status state machine.
 *
 * Every generated number starts with the 4242 test BIN, so nothing here can
 * ever resemble a real PAN. The full number exists in exactly one place: the
 * creation response. Records keep the last four and a reference.
 */

export const TEST_BIN = "4242"
export const CARD_NUMBER_LENGTH = 16

/** Highest spend limit a card can be issued with, in integer minor units. */
export const MAX_SPEND_LIMIT = 5_000_000

export const CARD_CATEGORIES: readonly CardCategory[] = [
  "any",
  "advertising",
  "software",
  "travel",
  "office_supplies",
  "contractors",
]

export const CARD_CATEGORY_LABELS: Record<CardCategory, string> = {
  any: "Any merchant",
  advertising: "Advertising",
  software: "Software",
  travel: "Travel",
  office_supplies: "Office supplies",
  contractors: "Contractors",
}

/** Luhn check digit for a string of digits (without the check digit). */
export function luhnCheckDigit(partial: string): string {
  if (!/^\d+$/.test(partial)) throw new Error("Luhn input must be digits")
  let sum = 0
  // Walk right to left; the digit immediately left of the check digit doubles.
  for (let i = partial.length - 1, double = true; i >= 0; i--, double = !double) {
    let digit = Number(partial[i])
    if (double) {
      digit *= 2
      if (digit > 9) digit -= 9
    }
    sum += digit
  }
  return String((10 - (sum % 10)) % 10)
}

/** True when the whole number, check digit included, passes Luhn. */
export function isLuhnValid(number: string): boolean {
  if (!/^\d{2,}$/.test(number)) return false
  return luhnCheckDigit(number.slice(0, -1)) === number.slice(-1)
}

/**
 * Generate a 16-digit number on the test BIN with a valid check digit.
 * `random` is injectable so the seed can produce deterministic cards.
 */
export function generateCardNumber(random: () => number = Math.random): string {
  const bodyLength = CARD_NUMBER_LENGTH - TEST_BIN.length - 1
  let body = ""
  for (let i = 0; i < bodyLength; i++) {
    body += String(Math.floor(random() * 10))
  }
  const partial = TEST_BIN + body
  return partial + luhnCheckDigit(partial)
}

export function lastFour(number: string): string {
  return number.slice(-4)
}

/** The only way a card number is ever shown after creation. */
export function maskCardNumber(last4: string): string {
  return `•••• ${last4}`
}

/** Legal next states. `cancelled` has none: it is terminal. */
export const CARD_TRANSITIONS: Record<CardStatus, readonly CardStatus[]> = {
  active: ["frozen", "cancelled"],
  frozen: ["active", "cancelled"],
  cancelled: [],
}

export function canTransition(from: CardStatus, to: CardStatus): boolean {
  return CARD_TRANSITIONS[from].includes(to)
}
