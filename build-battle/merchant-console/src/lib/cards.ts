import { CardCategory, CardStatus } from "@/data/types"

/**
 * Card number generation and the status state machine.
 *
 * Every number starts with the 4242 test BIN so nothing in this repository
 * can resemble a real PAN. Numbers are generated on the server only; the
 * full number exists in exactly one response, the creation one.
 */

export const CARD_BIN = "4242"
export const CARD_NUMBER_LENGTH = 16

/** Luhn check digit for a string of digits (the number without its last digit). */
export function luhnCheckDigit(partial: string): number {
  let sum = 0
  // Walk right to left; the check digit position makes these all "doubled".
  for (let i = partial.length - 1, double = true; i >= 0; i--, double = !double) {
    let digit = partial.charCodeAt(i) - 48
    if (double) {
      digit *= 2
      if (digit > 9) digit -= 9
    }
    sum += digit
  }
  return (10 - (sum % 10)) % 10
}

/** True when a full number's Luhn check digit is valid. */
export function isValidLuhn(number: string): boolean {
  if (!/^\d+$/.test(number) || number.length < 2) return false
  const digit = luhnCheckDigit(number.slice(0, -1))
  return digit === number.charCodeAt(number.length - 1) - 48
}

/**
 * Generate a 16-digit number on the 4242 test BIN with a valid Luhn check
 * digit. `random` is injectable so tests can be deterministic.
 */
export function generateCardNumber(random: () => number = Math.random): string {
  let body = CARD_BIN
  while (body.length < CARD_NUMBER_LENGTH - 1) {
    body += String(Math.floor(random() * 10))
  }
  return body + String(luhnCheckDigit(body))
}

/** The only way a card number is ever shown outside the creation response. */
export function maskCard(last4: string): string {
  return `•••• ${last4}`
}

/** Display names for the category lock. One copy, used by the form and the card. */
export const CARD_CATEGORY_LABELS: Record<CardCategory, string> = {
  advertising: "Advertising",
  software: "Software",
  travel: "Travel",
  office_supplies: "Office supplies",
  professional_services: "Professional services",
}

export const CARD_STATUSES: readonly CardStatus[] = [
  "active",
  "frozen",
  "cancelled",
]

/**
 * active ⇄ frozen, either to cancelled, and cancelled is terminal.
 * Guarded here so the server enforces it, not only the UI.
 */
const TRANSITIONS: Record<CardStatus, readonly CardStatus[]> = {
  active: ["frozen", "cancelled"],
  frozen: ["active", "cancelled"],
  cancelled: [],
}

export function canTransition(from: CardStatus, to: CardStatus): boolean {
  return TRANSITIONS[from].includes(to)
}
