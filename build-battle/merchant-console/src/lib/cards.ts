/**
 * Card numbers and the arithmetic around a spend limit.
 *
 * Nothing here touches the store, so it stays cheap to test. Every number
 * this module produces is on the 4242 test BIN and carries a valid Luhn
 * check digit: nothing in this repository may resemble a real PAN.
 */

export const TEST_BIN = "4242"
export const CARD_NUMBER_LENGTH = 16

/** Past this share of the limit, the spend bar warns. */
export const SPEND_WARNING_RATIO = 0.8

/**
 * Luhn, run right to left: double every second digit and cast out nines.
 * A number is valid when the total is a multiple of ten.
 */
function luhnSum(digits: string, doubleFirst: boolean): number {
  let total = 0
  for (let i = digits.length - 1, position = 0; i >= 0; i--, position++) {
    let value = digits.charCodeAt(i) - 48
    const doubled = position % 2 === (doubleFirst ? 0 : 1)
    if (doubled) {
      value *= 2
      if (value > 9) value -= 9
    }
    total += value
  }
  return total
}

/** The digit that makes `partial` a valid number once appended. */
export function luhnCheckDigit(partial: string): string {
  const remainder = luhnSum(partial, true) % 10
  return String((10 - remainder) % 10)
}

/** Whether a complete number carries a valid Luhn check digit. */
export function isValidLuhn(candidate: string): boolean {
  if (!/^\d+$/.test(candidate)) return false
  return luhnSum(candidate, false) % 10 === 0
}

/**
 * A 16-digit number on the test BIN, with a computed check digit.
 *
 * The random source is injectable so tests can pin the output without a
 * hardcoded number standing in for a generator.
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

/**
 * Takes the last four, never a full number: a helper that accepted a PAN
 * would invite someone to pass one.
 */
export function maskCardNumber(last4: string): string {
  return `•••• ${last4}`
}

/** Spend as a share of the limit, clamped to 0..1. */
export function spendRatio(spent: number, limit: number): number {
  if (limit <= 0) return 0
  return Math.min(Math.max(spent / limit, 0), 1)
}

/** Whether spend has reached the point where the bar should warn. */
export function isNearLimit(spent: number, limit: number): boolean {
  return spendRatio(spent, limit) >= SPEND_WARNING_RATIO
}
