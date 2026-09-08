import { CardStatus } from "@/data/types"

/**
 * Card helpers. Generation is server-side only; a card number produced in the
 * browser is a bug (see .claude/rules/cards.md).
 */

export const TEST_BIN = "4242"
export const CARD_NUMBER_LENGTH = 16
export const MAX_LIMIT_MINOR_UNITS = 5_000_000

/**
 * Luhn check digit for a numeric string. Doubles every second digit from the
 * right, sums the digits of each doubled value, and returns the digit that
 * makes the total divisible by 10.
 */
export function luhnCheckDigit(digits: string): number {
  let sum = 0
  for (let i = 0; i < digits.length; i++) {
    const d = digits.charCodeAt(digits.length - 1 - i) - 48
    if (i % 2 === 0) {
      const doubled = d * 2
      sum += doubled > 9 ? doubled - 9 : doubled
    } else {
      sum += d
    }
  }
  return (10 - (sum % 10)) % 10
}

/** True if the whole number passes Luhn. Used in tests and in defense-in-depth. */
export function isValidLuhn(number: string): boolean {
  if (!/^\d+$/.test(number)) return false
  const body = number.slice(0, -1)
  const check = Number(number[number.length - 1])
  return luhnCheckDigit(body) === check
}

/**
 * Generate a 16-digit card number on the 4242 test BIN with a valid Luhn
 * check digit. Returns the full number, the last four, and an opaque reference
 * that stands in for the number in the store.
 */
export function generateCardNumber(
  rand: () => number = Math.random,
): { full: string; last4: string; reference: string } {
  const middleLength = CARD_NUMBER_LENGTH - TEST_BIN.length - 1
  let middle = ""
  for (let i = 0; i < middleLength; i++) {
    middle += Math.floor(rand() * 10).toString()
  }
  const body = TEST_BIN + middle
  const full = body + luhnCheckDigit(body).toString()
  return {
    full,
    last4: full.slice(-4),
    reference: `cref_${full.slice(-6)}_${Date.now().toString(36)}`,
  }
}

/**
 * Status state machine, per .claude/rules/cards.md:
 *   active ⇄ frozen, either → cancelled, cancelled is terminal.
 */
const ALLOWED: Record<CardStatus, ReadonlySet<CardStatus>> = {
  active: new Set<CardStatus>(["frozen", "cancelled"]),
  frozen: new Set<CardStatus>(["active", "cancelled"]),
  cancelled: new Set<CardStatus>(),
}

export function canTransition(from: CardStatus, to: CardStatus): boolean {
  return ALLOWED[from].has(to)
}

export function maskedNumber(last4: string): string {
  return `•••• ${last4}`
}
