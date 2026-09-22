import { CardStatus } from "@/data/types"

/**
 * Card numbers are generated server-side only, on the 4242 test BIN.
 * A card number produced in the browser is a bug.
 */

const BIN = "4242"
const NUMBER_LENGTH = 16

/** Luhn check digit for a string of digits (the number without its check digit). */
export function luhnCheckDigit(digits: string): string {
  let sum = 0
  let double = true
  for (let i = digits.length - 1; i >= 0; i--) {
    let d = Number(digits[i])
    if (double) {
      d *= 2
      if (d > 9) d -= 9
    }
    sum += d
    double = !double
  }
  return String((10 - (sum % 10)) % 10)
}

/** True if a full digit string (including its check digit) passes Luhn. */
export function isLuhnValid(fullNumber: string): boolean {
  const body = fullNumber.slice(0, -1)
  const checkDigit = fullNumber.slice(-1)
  return luhnCheckDigit(body) === checkDigit
}

/** Generates a 16-digit number on the 4242 test BIN with a valid Luhn check digit. */
export function generateCardNumber(): string {
  let body = BIN
  for (let i = BIN.length; i < NUMBER_LENGTH - 1; i++) {
    body += String(Math.floor(Math.random() * 10))
  }
  return body + luhnCheckDigit(body)
}

/** Last four digits of a full number, the only part ever stored. */
export function last4Of(fullNumber: string): string {
  return fullNumber.slice(-4)
}

/** Display form for anywhere other than the one-time reveal: •••• 1234. */
export function maskCardNumber(last4: string): string {
  return `•••• ${last4}`
}

const TRANSITIONS: Record<CardStatus, readonly CardStatus[]> = {
  active: ["frozen", "cancelled"],
  frozen: ["active", "cancelled"],
  cancelled: [],
}

/** Status is a state machine: active ⇄ frozen, either → cancelled, cancelled is terminal. */
export function isValidStatusTransition(
  from: CardStatus,
  to: CardStatus,
): boolean {
  return TRANSITIONS[from].includes(to)
}
