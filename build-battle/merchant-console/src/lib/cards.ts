import { Card, CardCategory, CardStatus, Currency } from "@/data/types"

/**
 * Virtual card rules: number generation, masking, status transitions, and
 * spend against a limit.
 *
 * Numbers are generated here and only here, which is server-side code. A
 * number produced in the browser is a bug, and the full number never reaches
 * a Card record — the creation response is the one place it exists.
 */

/** Every generated number starts here, so nothing can resemble a real PAN. */
export const TEST_BIN = "4242"

const CARD_NUMBER_LENGTH = 16

export const CARD_CATEGORIES: readonly CardCategory[] = [
  "advertising",
  "software",
  "travel",
  "contractors",
  "utilities",
]

/** Largest limit ops may set, in minor units. */
export const SPEND_LIMIT_MAX = 5_000_000

/** Fraction of the limit at which the spend bar warns. */
export const SPEND_WARN_AT = 0.8

/** Sums a number's digits under the Luhn doubling rule, rightmost first. */
function luhnSum(digits: string, doubleFromRight: 0 | 1): number {
  let total = 0
  for (let i = digits.length - 1; i >= 0; i--) {
    const position = digits.length - 1 - i
    let value = Number(digits[i])
    if (position % 2 === doubleFromRight) {
      value *= 2
      if (value > 9) value -= 9
    }
    total += value
  }
  return total
}

/** The check digit that completes a partial number under Luhn. */
export function luhnCheckDigit(partial: string): string {
  const sum = luhnSum(partial, 0)
  return String((10 - (sum % 10)) % 10)
}

/** True when a complete number satisfies the Luhn checksum. */
export function isLuhnValid(number: string): boolean {
  if (!/^\d+$/.test(number)) return false
  return luhnSum(number, 1) % 10 === 0
}

/**
 * A 16 digit number on the test BIN with a valid check digit.
 *
 * Takes its randomness as an argument so a test can pin the draw; the default
 * is the platform generator.
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

/** The last four digits of a number, which is all a record may keep. */
export function lastFour(number: string): string {
  return number.slice(-4)
}

/** How a card number is shown anywhere other than the creation response. */
export function maskedNumber(last4: string): string {
  return `•••• ${last4}`
}

/**
 * Which statuses a card may move to from where it is now.
 *
 * `active` and `frozen` swap, either may be cancelled, and `cancelled` is
 * terminal, so nothing is reachable from it.
 */
export function allowedTransitions(from: CardStatus): readonly CardStatus[] {
  switch (from) {
    case "active":
      return ["frozen", "cancelled"]
    case "frozen":
      return ["active", "cancelled"]
    case "cancelled":
      return []
  }
}

/** True when a card may move from one status to another. */
export function canTransition(from: CardStatus, to: CardStatus): boolean {
  return allowedTransitions(from).includes(to)
}

/** True when a value is one of the three card statuses. */
export function isCardStatus(value: string): value is CardStatus {
  return value === "active" || value === "frozen" || value === "cancelled"
}

/** True when a value is one of the allowed category locks. */
export function isCardCategory(value: string): value is CardCategory {
  return (CARD_CATEGORIES as readonly string[]).includes(value)
}

/** True when a value is one of the three supported currencies. */
export function isCurrency(value: string): value is Currency {
  return value === "USD" || value === "EUR" || value === "GBP"
}

export interface SpendState {
  /** Spend as a percentage of the limit, clamped to 0 through 100. */
  percent: number
  /** Whether spend has reached the warning threshold. */
  warn: boolean
  remaining: number
}

/**
 * Spend against a limit, for the detail page's bar.
 *
 * A zero or negative limit yields 100 percent rather than dividing, so a bad
 * record renders as full instead of as NaN.
 */
export function spendState(spent: number, limit: number): SpendState {
  if (limit <= 0) return { percent: 100, warn: true, remaining: 0 }
  const raw = (spent / limit) * 100
  const percent = Math.max(0, Math.min(100, raw))
  return {
    percent,
    warn: spent / limit >= SPEND_WARN_AT,
    remaining: Math.max(0, limit - spent),
  }
}

/** The masked summary of a card, which is what every read path returns. */
export function maskCard(card: Card) {
  return { ...card, maskedNumber: maskedNumber(card.last4) }
}
