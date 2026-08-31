import { CardStatus } from "@/data/types"

/**
 * Card numbers, generated server-side on the 4242 test BIN, and the
 * active/frozen/cancelled state machine. Both are pure and stateless on
 * purpose — the store never has to be touched to test either one.
 */

const BIN = "4242"
const NUMBER_LENGTH = 16

/**
 * The Luhn check digit for a string of digits that does not yet include
 * one. Doubles every digit an even distance from the right (the position
 * the check digit's immediate neighbor lands on), per the standard
 * algorithm, then returns the digit that makes the full number's digit
 * sum a multiple of 10.
 */
export function luhnCheckDigit(digits: string): number {
  let sum = 0
  for (let i = 0; i < digits.length; i++) {
    const fromRight = digits.length - 1 - i
    let digit = Number(digits[i])
    if (fromRight % 2 === 0) {
      digit *= 2
      if (digit > 9) digit -= 9
    }
    sum += digit
  }
  return (10 - (sum % 10)) % 10
}

/** True if a full digit string (including its own check digit) is Luhn-valid. */
export function isValidLuhn(number: string): boolean {
  if (!/^\d+$/.test(number)) return false
  const body = number.slice(0, -1)
  const checkDigit = Number(number.slice(-1))
  return luhnCheckDigit(body) === checkDigit
}

/**
 * Generates a card number on the 4242 test BIN with a valid Luhn check
 * digit. `random` is injectable so tests can assert on more than "it ran
 * without throwing" without needing to seed a global PRNG.
 */
export function generateCardNumber(random: () => number = Math.random): {
  number: string
  last4: string
} {
  const middleLength = NUMBER_LENGTH - BIN.length - 1
  let middle = ""
  for (let i = 0; i < middleLength; i++) {
    middle += Math.floor(random() * 10)
  }
  const body = BIN + middle
  const number = body + String(luhnCheckDigit(body))
  return { number, last4: number.slice(-4) }
}

const TRANSITIONS: Record<CardStatus, readonly CardStatus[]> = {
  active: ["frozen", "cancelled"],
  frozen: ["active", "cancelled"],
  cancelled: [],
}

/** Guards active ⇄ frozen, either → cancelled, cancelled terminal. */
export function isValidCardTransition(
  from: CardStatus,
  to: CardStatus,
): boolean {
  return TRANSITIONS[from].includes(to)
}
