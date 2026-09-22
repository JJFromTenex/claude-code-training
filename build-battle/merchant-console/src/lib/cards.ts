import { CardStatus } from "@/data/types"

/**
 * Card number generation and status transitions.
 *
 * Numbers are generated here, on the server, and never in the browser. Every
 * number starts with the `4242` test BIN and carries a valid Luhn check digit,
 * so nothing produced here can resemble a real PAN.
 */

/** The test BIN. Every generated number starts with these four digits. */
const TEST_BIN = "4242"

const LENGTH = 16

/** Uniform 0–9 from the platform CSPRNG, rejecting a byte's biased tail. */
function randomDigit(): number {
  const byte = new Uint8Array(1)
  do {
    crypto.getRandomValues(byte)
  } while (byte[0] >= 250)
  return byte[0] % 10
}

/**
 * The Luhn check digit for a partial number — the digits that will sit to the
 * left of it. Doubling starts at the rightmost digit of `partial`, because the
 * check digit itself occupies the position after it.
 */
export function luhnCheckDigit(partial: string): number {
  let sum = 0
  for (let i = 0; i < partial.length; i++) {
    const digit = Number(partial[partial.length - 1 - i])
    if (i % 2 === 0) {
      const doubled = digit * 2
      sum += doubled > 9 ? doubled - 9 : doubled
    } else {
      sum += digit
    }
  }
  return (10 - (sum % 10)) % 10
}

/** A 16-digit test number: the `4242` BIN, 11 random digits, a check digit. */
export function generateCardNumber(): string {
  let partial = TEST_BIN
  while (partial.length < LENGTH - 1) {
    partial += randomDigit()
  }
  return partial + luhnCheckDigit(partial)
}

/** How a card number is written everywhere except the creation response. */
export function maskedNumber(last4: string): string {
  return `•••• ${last4}`
}

/** `active ⇄ frozen`, either to `cancelled`, and `cancelled` is terminal. */
const TRANSITIONS: Record<CardStatus, readonly CardStatus[]> = {
  active: ["frozen", "cancelled"],
  frozen: ["active", "cancelled"],
  cancelled: [],
}

/**
 * Callers must guard with this on the server. A UI that only hides the button
 * is not a guard.
 */
export function canTransition(from: CardStatus, to: CardStatus): boolean {
  return TRANSITIONS[from].includes(to)
}
