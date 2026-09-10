import { CardStatus } from "@/data/types"

/**
 * Card mechanics: number generation, masking, and the status state machine.
 *
 * Everything here is pure. Nothing in this file reads the store, and nothing
 * in it may run in the browser — a card number produced client-side is a bug.
 */

/**
 * The only BIN this repository may ever produce. Every generated number starts
 * here so nothing in the app can resemble a real PAN, in tests included.
 */
export const TEST_BIN = "4242"

const CARD_NUMBER_LENGTH = 16

/**
 * The Luhn check digit for a payload that does not carry one yet.
 * Doubling starts at the payload's rightmost digit, because the check digit
 * that will be appended occupies the position after it.
 */
export function luhnCheckDigit(payload: string): number {
  let sum = 0
  let double = true
  for (let i = payload.length - 1; i >= 0; i--) {
    let digit = Number(payload[i])
    if (double) {
      digit *= 2
      if (digit > 9) digit -= 9
    }
    sum += digit
    double = !double
  }
  return (10 - (sum % 10)) % 10
}

/** Whether a complete number carries the check digit its payload implies. */
export function isLuhnValid(cardNumber: string): boolean {
  if (!/^\d{2,}$/.test(cardNumber)) return false
  const payload = cardNumber.slice(0, -1)
  return luhnCheckDigit(payload) === Number(cardNumber.slice(-1))
}

/**
 * A sixteen-digit test number: the `4242` BIN, eleven random digits, and a
 * Luhn check digit. The random source is injectable so the seed can be
 * deterministic and the tests can be exhaustive.
 */
export function generateCardNumber(random: () => number = Math.random): string {
  let payload = TEST_BIN
  while (payload.length < CARD_NUMBER_LENGTH - 1) {
    payload += Math.floor(random() * 10)
  }
  return payload + luhnCheckDigit(payload)
}

/** The four digits a card record is allowed to keep. */
export function lastFour(cardNumber: string): string {
  return cardNumber.slice(-4)
}

/** How a card number is shown everywhere except the creation response. */
export function maskLast4(last4: string): string {
  return `•••• ${last4}`
}

export const CARD_STATUSES: readonly CardStatus[] = [
  "active",
  "frozen",
  "cancelled",
]

/**
 * `active ⇄ frozen`, either to `cancelled`, and `cancelled` is terminal.
 * Re-applying a status a card already holds is not a transition; the caller
 * asked for something that has already happened.
 */
const TRANSITIONS: Record<CardStatus, readonly CardStatus[]> = {
  active: ["frozen", "cancelled"],
  frozen: ["active", "cancelled"],
  cancelled: [],
}

export function canTransition(from: CardStatus, to: CardStatus): boolean {
  return TRANSITIONS[from].includes(to)
}
