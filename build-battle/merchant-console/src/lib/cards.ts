import { CardStatus } from "@/data/types"

/**
 * Card number generation and status transitions.
 *
 * Everything here is pure and server-only by convention: a card number
 * produced in the browser is a bug. The full number exists in exactly one
 * response — the creation one — and is never written to a card record.
 */

/** The test BIN. Nothing in this repository may resemble a real PAN. */
export const TEST_BIN = "4242"

const PAN_LENGTH = 16

/**
 * Luhn check digit for a partial number, i.e. the digit that makes the whole
 * string pass `isLuhnValid`. The rightmost digit of the partial is doubled,
 * because the check digit will sit to the right of it.
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
    sum += digit
    double = !double
  }
  return (10 - (sum % 10)) % 10
}

/** Whether a complete number satisfies the Luhn checksum. */
export function isLuhnValid(pan: string): boolean {
  if (!/^\d+$/.test(pan)) return false
  let sum = 0
  let double = false
  for (let i = pan.length - 1; i >= 0; i--) {
    let digit = Number(pan[i])
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
 * `random` is injectable so tests can pin the output.
 */
export function generateCardNumber(random: () => number = Math.random): string {
  const middleLength = PAN_LENGTH - TEST_BIN.length - 1
  let middle = ""
  for (let i = 0; i < middleLength; i++) {
    middle += String(Math.floor(random() * 10))
  }
  const partial = TEST_BIN + middle
  return partial + String(luhnCheckDigit(partial))
}

/** The last four digits of a full number. The only part ever stored. */
export function lastFour(pan: string): string {
  return pan.slice(-4)
}

/** How a card number is rendered anywhere that is not the reveal. */
export function maskCardNumber(last4: string): string {
  return `•••• ${last4}`
}

/**
 * The status state machine. `active ⇄ frozen`, either to `cancelled`, and
 * `cancelled` is terminal. Guarded here so the server enforces it, not the UI.
 */
const TRANSITIONS: Record<CardStatus, readonly CardStatus[]> = {
  active: ["frozen", "cancelled"],
  frozen: ["active", "cancelled"],
  cancelled: [],
}

export function canTransition(from: CardStatus, to: CardStatus): boolean {
  return TRANSITIONS[from]?.includes(to) ?? false
}

/** The statuses a card can legally move to right now. Drives the UI too. */
export function allowedTransitions(from: CardStatus): readonly CardStatus[] {
  return TRANSITIONS[from] ?? []
}

/**
 * Spend as a fraction of the limit, clamped to [0, 1].
 * Both arguments are integer minor units in the same currency.
 */
export function spendRatio(spend: number, limit: number): number {
  if (limit <= 0) return 0
  return Math.min(1, Math.max(0, spend / limit))
}
