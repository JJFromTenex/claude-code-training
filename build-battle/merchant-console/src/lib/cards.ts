import { CardStatus } from "@/data/types"

/**
 * Card numbers are constructed here and nowhere else.
 *
 * Every number sits on the 4242 test BIN and carries a valid Luhn check digit,
 * so nothing in this repository can resemble a real PAN. Generation is
 * server-side only: a number produced in the browser is a bug.
 */

export const TEST_BIN = "4242"

const CARD_NUMBER_LENGTH = 16

/**
 * The Luhn check digit for a partial number — the number without its final
 * digit. Walks right to left doubling every second digit, starting with the
 * rightmost, because the check digit itself occupies the undoubled position.
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
    sum += digit
    double = !double
  }

  return (10 - (sum % 10)) % 10
}

export function isLuhnValid(cardNumber: string): boolean {
  if (!/^\d{2,}$/.test(cardNumber)) return false
  return luhnCheckDigit(cardNumber.slice(0, -1)) === Number(cardNumber.slice(-1))
}

/**
 * A 16-digit test-BIN number with a valid check digit.
 * The random source is injectable so seeds and tests stay deterministic.
 */
export function generateCardNumber(random: () => number = Math.random): string {
  let partial = TEST_BIN
  while (partial.length < CARD_NUMBER_LENGTH - 1) {
    partial += String(Math.floor(random() * 10))
  }
  return partial + String(luhnCheckDigit(partial))
}

export function lastFour(cardNumber: string): string {
  return cardNumber.slice(-4)
}

/** How a card number appears everywhere except the creation response. */
export function maskLast4(last4: string): string {
  return `•••• ${last4}`
}

/**
 * active ⇄ frozen, either to cancelled, and cancelled is terminal.
 *
 * Guarded on the server. A hidden button in the UI is a convenience, never the
 * enforcement — a crafted request must not bring a cancelled card back.
 */
const TRANSITIONS: Record<CardStatus, readonly CardStatus[]> = {
  active: ["frozen", "cancelled"],
  frozen: ["active", "cancelled"],
  cancelled: [],
}

export function canTransition(from: CardStatus, to: CardStatus): boolean {
  return TRANSITIONS[from].includes(to)
}

export function allowedTransitions(from: CardStatus): readonly CardStatus[] {
  return TRANSITIONS[from]
}
