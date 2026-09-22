import { Card } from "@/data/types"

/**
 * Pure card helpers, safe in a client bundle. The Luhn maths lives here
 * because both the server generator and its tests need it; anything that
 * needs randomness lives in card-number.ts, which is server-only.
 */

/** The only BIN this codebase issues on. */
export const TEST_BIN = "4242"

export const CARD_NUMBER_LENGTH = 16

/** Luhn sum over a digit string, doubling every second digit from the right. */
function luhnSum(digits: string): number {
  let sum = 0
  for (let i = digits.length - 1, position = 0; i >= 0; i--, position++) {
    let digit = digits.charCodeAt(i) - 48
    if (position % 2 === 1) {
      digit *= 2
      if (digit > 9) digit -= 9
    }
    sum += digit
  }
  return sum
}

/** The digit that makes `payload` + itself a Luhn-valid number. */
export function luhnCheckDigit(payload: string): number {
  return (10 - (luhnSum(`${payload}0`) % 10)) % 10
}

/** Whether a complete number carries a valid Luhn check digit. */
export function isValidLuhn(number: string): boolean {
  if (!/^\d+$/.test(number)) return false
  return luhnSum(number) % 10 === 0
}

/** How a card number appears everywhere except the one creation response. */
export function maskCardNumber(last4: string): string {
  return `•••• ${last4}`
}

/** Next id in the house sequence, read off the existing cards rather than a counter. */
export function nextCardId(cards: Card[]): string {
  const highest = cards.reduce((max, card) => {
    const suffix = Number(card.id.replace("card_", ""))
    return Number.isFinite(suffix) && suffix > max ? suffix : max
  }, 0)
  return `card_${String(highest + 1).padStart(6, "0")}`
}

/** The percentage at which the spend bar warns rather than reassures. */
export const SPEND_AMBER_AT = 80

/**
 * Spend as a whole-number percentage of the limit. A ratio, not an amount, so
 * the multiply-by-100 here is percent arithmetic rather than a minor-units
 * conversion. Floors, so 99.9% of a limit never reads as spent out.
 */
export function spendPercentage(spent: number, spendLimit: number): number {
  if (spendLimit <= 0) return 0
  return Math.floor((spent * 100) / spendLimit)
}
