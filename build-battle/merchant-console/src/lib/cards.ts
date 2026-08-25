import { CardStatus } from "@/data/types"

/**
 * Virtual card primitives.
 *
 * Everything here is pure, so the rules that matter most — the test BIN, the
 * Luhn digit, and the status machine — are provable without a request or a DOM.
 */

/** The test BIN. Every generated number starts here, so nothing resembles a real PAN. */
export const TEST_BIN = "4242"

/** Generated numbers are 16 digits: the BIN, 11 random digits, one check digit. */
const CARD_NUMBER_LENGTH = 16

/**
 * Luhn check digit for a partial number.
 *
 * Doubling starts from the rightmost digit of the finished number, so with the
 * check digit not yet appended the leftmost of each pair is the doubled one.
 */
export function luhnCheckDigit(partial: string): number {
  let sum = 0
  let double = true

  for (let i = partial.length - 1; i >= 0; i--) {
    let digit = Number(partial[i])
    if (double) {
      digit *= 2
      if (digit > 9) digit -= 9
    }
    double = !double
    sum += digit
  }

  return (10 - (sum % 10)) % 10
}

/** Does a complete number satisfy Luhn? */
export function isValidLuhn(cardNumber: string): boolean {
  if (!/^\d+$/.test(cardNumber)) return false
  const body = cardNumber.slice(0, -1)
  const check = Number(cardNumber.slice(-1))
  return luhnCheckDigit(body) === check
}

/**
 * Generate a card number on the test BIN.
 *
 * Server-side only: a number produced in the browser is a bug. `random` is
 * injectable so tests and the deterministic seed can drive it.
 */
export function generateCardNumber(random: () => number = Math.random): string {
  let body = TEST_BIN
  while (body.length < CARD_NUMBER_LENGTH - 1) {
    body += Math.floor(random() * 10)
  }
  return body + luhnCheckDigit(body)
}

/** The last four of a number. The only part of it that may be stored. */
export function lastFourOf(cardNumber: string): string {
  return cardNumber.slice(-4)
}

/** How a card number is written anywhere other than the creation response. */
export function maskedNumber(last4: string): string {
  return `•••• ${last4}`
}

/**
 * The status machine: active ⇄ frozen, either to cancelled, cancelled is
 * terminal. Held as data so the guard and the UI cannot disagree about it.
 */
const TRANSITIONS: Record<CardStatus, readonly CardStatus[]> = {
  active: ["frozen", "cancelled"],
  frozen: ["active", "cancelled"],
  cancelled: [],
}

export const CARD_STATUSES = Object.keys(TRANSITIONS) as CardStatus[]

/** Is this a legal move? Guarded on the server, not only in the UI. */
export function canTransition(from: CardStatus, to: CardStatus): boolean {
  return TRANSITIONS[from]?.includes(to) ?? false
}

/** The moves available from a status, for rendering the right controls. */
export function allowedTransitions(from: CardStatus): readonly CardStatus[] {
  return TRANSITIONS[from] ?? []
}
