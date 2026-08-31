import { CardStatus } from "@/data/types"

/**
 * Card number generation and the status state machine.
 *
 * Pure functions only: nothing here touches the store, so the Luhn maths and
 * the legal transitions can be pinned by tests without a running app.
 *
 * Every number generated here starts with the 4242 test BIN. That is not a
 * default, it is the reason nothing in this repository can resemble a real PAN.
 */

/** The test BIN. Every generated number starts here. */
export const CARD_BIN = "4242"

const CARD_NUMBER_LENGTH = 16

/**
 * The Luhn check digit for a partial number, i.e. the digit that makes the
 * whole string pass `isValidLuhn`.
 *
 * Doubling runs right to left from the check digit's position, so the digit
 * immediately left of it is the first one doubled.
 */
export function luhnCheckDigit(partial: string): string {
  let sum = 0
  let double = true

  for (let i = partial.length - 1; i >= 0; i--) {
    let digit = Number(partial[i])
    if (double) {
      digit *= 2
      if (digit > 9) digit -= 9
    }
    sum += digit
    double = !double
  }

  return String((10 - (sum % 10)) % 10)
}

/** True when a complete number carries a valid Luhn check digit. */
export function isValidLuhn(number: string): boolean {
  if (!/^\d+$/.test(number)) return false
  const body = number.slice(0, -1)
  const check = number.slice(-1)
  return luhnCheckDigit(body) === check
}

/**
 * A 16-digit number on the test BIN with a valid check digit.
 *
 * Server-side only. A card number produced in the browser is a bug, so this
 * is called from the route handler and nowhere a client bundle can reach.
 */
export function generateCardNumber(): string {
  const middleLength = CARD_NUMBER_LENGTH - CARD_BIN.length - 1
  let middle = ""
  for (let i = 0; i < middleLength; i++) {
    middle += Math.floor(Math.random() * 10)
  }
  const partial = CARD_BIN + middle
  return partial + luhnCheckDigit(partial)
}

/** The masked form shown everywhere except the creation response. */
export function maskCardNumber(last4: string): string {
  return `•••• ${last4}`
}

export function last4Of(number: string): string {
  return number.slice(-4)
}

/**
 * The state machine, in one place: `active ⇄ frozen`, either to `cancelled`,
 * and `cancelled` is terminal. Routes guard on this — the UI hiding a button
 * is a convenience, not the rule.
 */
const TRANSITIONS: Record<CardStatus, readonly CardStatus[]> = {
  active: ["frozen", "cancelled"],
  frozen: ["active", "cancelled"],
  cancelled: [],
}

export function isValidCardTransition(from: CardStatus, to: CardStatus): boolean {
  return TRANSITIONS[from].includes(to)
}

/** The transitions a card can currently make. Drives which controls render. */
export function allowedTransitions(from: CardStatus): readonly CardStatus[] {
  return TRANSITIONS[from]
}
