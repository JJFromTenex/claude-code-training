import { CardCategory, CardStatus } from "@/data/types"

/**
 * Pure card domain logic: number generation, masking, the category
 * allowlist, and the status state machine. No store imports here — this
 * stays safe to unit test in isolation and safe to call from a route
 * handler without dragging in the store.
 */

const TEST_BIN = "4242"

/** The only card categories the console recognizes. Validate against this. */
export const CARD_CATEGORIES: readonly CardCategory[] = [
  "advertising",
  "software",
  "shipping",
  "office",
  "travel",
]

/** Server-side ceiling on a card's spend limit, in minor units. */
export const CARD_LIMIT_MAX_MINOR_UNITS = 5_000_000

/**
 * Luhn check digit for a string of digits that does not yet include one.
 * Doubles every second digit counting from the rightmost (the digit
 * immediately before where the check digit will go).
 */
function luhnCheckDigit(digits: string): number {
  let sum = 0
  let double = true
  for (let i = digits.length - 1; i >= 0; i--) {
    let digit = Number(digits[i])
    if (double) {
      digit *= 2
      if (digit > 9) digit -= 9
    }
    sum += digit
    double = !double
  }
  return (10 - (sum % 10)) % 10
}

/**
 * Generates a 16-digit test card number: the `4242` BIN, eleven random
 * digits, and a trailing Luhn check digit. Accepts an injectable RNG so
 * tests are deterministic; real callers can leave it as Math.random.
 *
 * Never call this from the browser — generation belongs on the server.
 */
export function generateCardNumber(random: () => number = Math.random): string {
  let body = TEST_BIN
  for (let i = 0; i < 11; i++) {
    body += Math.floor(random() * 10).toString()
  }
  return body + String(luhnCheckDigit(body))
}

/** Mask a card down to its last four for anywhere the full number can't go. */
export function maskCard(last4: string): string {
  return `•••• ${last4}`
}

/**
 * Status is a state machine: active and frozen flip back and forth, either
 * can move to cancelled, and cancelled is terminal. Guard every mutation
 * through this — the UI checking is a convenience, not the enforcement.
 */
const TRANSITIONS: Record<CardStatus, readonly CardStatus[]> = {
  active: ["frozen", "cancelled"],
  frozen: ["active", "cancelled"],
  cancelled: [],
}

export function canTransition(from: CardStatus, to: CardStatus): boolean {
  return TRANSITIONS[from].includes(to)
}
