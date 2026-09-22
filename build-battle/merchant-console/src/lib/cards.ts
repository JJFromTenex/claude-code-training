import { CardCategory, CardStatus } from "@/data/types"

/**
 * Card numbers and the card status state machine. Pure functions only, so
 * they run in Node tests and in route handlers alike.
 */

/** Every generated number starts here so nothing can resemble a real PAN. */
export const TEST_BIN = "4242"

export const CARD_NUMBER_LENGTH = 16

/** Spend limits are integer minor units, capped by the ticket. */
export const MAX_SPEND_LIMIT = 5_000_000

export const CARD_STATUSES: readonly CardStatus[] = [
  "active",
  "frozen",
  "cancelled",
]

export const CARD_CATEGORIES: readonly CardCategory[] = [
  "general",
  "advertising",
  "software",
  "contractors",
  "travel",
]

/** The Luhn check digit that makes `digits` + digit pass `isLuhnValid`. */
export function luhnCheckDigit(digits: string): string {
  let sum = 0
  // Walk right to left. The check digit will sit at position 0, so the
  // rightmost payload digit is doubled.
  for (let i = digits.length - 1, double = true; i >= 0; i--, double = !double) {
    let d = Number(digits[i])
    if (double) {
      d *= 2
      if (d > 9) d -= 9
    }
    sum += d
  }
  return String((10 - (sum % 10)) % 10)
}

export function isLuhnValid(number: string): boolean {
  if (!/^\d+$/.test(number) || number.length < 2) return false
  const payload = number.slice(0, -1)
  return luhnCheckDigit(payload) === number.slice(-1)
}

/**
 * A 16-digit number on the test BIN with a valid check digit.
 * Server-side only; a number produced in the browser is a bug.
 */
export function generateCardNumber(): string {
  const randomLength = CARD_NUMBER_LENGTH - TEST_BIN.length - 1
  const bytes = new Uint8Array(randomLength)
  crypto.getRandomValues(bytes)
  const body = Array.from(bytes, (b) => String(b % 10)).join("")
  const payload = TEST_BIN + body
  return payload + luhnCheckDigit(payload)
}

/** The only shape a card number takes outside the creation response. */
export function maskCardNumber(last4: string): string {
  return `•••• ${last4}`
}

/**
 * active ⇄ frozen, either to cancelled, and cancelled is terminal.
 * A transition to the current status is not a transition.
 */
const TRANSITIONS: Record<CardStatus, readonly CardStatus[]> = {
  active: ["frozen", "cancelled"],
  frozen: ["active", "cancelled"],
  cancelled: [],
}

export function canTransition(from: CardStatus, to: CardStatus): boolean {
  return TRANSITIONS[from].includes(to)
}

export function nextStatuses(from: CardStatus): readonly CardStatus[] {
  return TRANSITIONS[from]
}
