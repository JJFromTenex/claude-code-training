import { CardCategory, CardStatus } from "@/data/types"

/**
 * Pure card helpers: number generation, masking, status transitions, and the
 * spend maths the detail view draws. Nothing here reads the store or touches
 * Next, so a client component can import it without dragging the server in.
 *
 * Every generated number sits on the 4242 test BIN, so nothing this file can
 * produce resembles a real PAN.
 */

/** The only BIN this codebase issues on. Not configurable, on purpose. */
export const TEST_BIN = "4242"

export const CARD_NUMBER_LENGTH = 16

/**
 * The Luhn check digit for a number that does not have one yet.
 * Doubling starts at the rightmost supplied digit, because the check digit
 * that will be appended occupies the position after it.
 */
export function luhnCheckDigit(digits: string): string {
  let sum = 0
  for (let i = digits.length - 1, position = 0; i >= 0; i--, position++) {
    let value = digits.charCodeAt(i) - 48
    if (position % 2 === 0) {
      value *= 2
      if (value > 9) value -= 9
    }
    sum += value
  }
  return String((10 - (sum % 10)) % 10)
}

/** Whether a complete, digits-only number carries a valid check digit. */
export function isValidLuhn(number: string): boolean {
  if (!/^\d+$/.test(number)) return false
  const body = number.slice(0, -1)
  const check = number.slice(-1)
  return luhnCheckDigit(body) === check
}

/**
 * A fresh test-BIN number. Randomness comes from the Web Crypto API rather
 * than Math.random so the same digits are not handed to two merchants after a
 * process fork.
 */
export function generateCardNumber(): string {
  const randomDigits = CARD_NUMBER_LENGTH - TEST_BIN.length - 1
  const bytes = new Uint8Array(randomDigits)
  globalThis.crypto.getRandomValues(bytes)
  let body = TEST_BIN
  for (const byte of bytes) body += String(byte % 10)
  return body + luhnCheckDigit(body)
}

/**
 * An opaque handle for a generated number. It is random, never derived from
 * the number, so holding one gets you no closer to the PAN.
 */
export function generateNumberReference(): string {
  const bytes = new Uint8Array(12)
  globalThis.crypto.getRandomValues(bytes)
  let hex = ""
  for (const byte of bytes) hex += byte.toString(16).padStart(2, "0")
  return `pan_${hex}`
}

/** The masked form shown everywhere after the one-time reveal. */
export function maskCardNumber(last4: string): string {
  return `•••• ${last4}`
}

/** The state machine from the ticket: active ⇄ frozen, either to cancelled. */
export const CARD_TRANSITIONS: Record<CardStatus, readonly CardStatus[]> = {
  active: ["frozen", "cancelled"],
  frozen: ["active", "cancelled"],
  cancelled: [],
}

export function canTransition(from: CardStatus, to: CardStatus): boolean {
  return CARD_TRANSITIONS[from].includes(to)
}

/**
 * Spend as a fraction of the limit, for the progress bar. Display maths on
 * integer minor units — the ratio is computed where it is drawn and never
 * stored.
 */
export function spendRatio(spent: number, limit: number): number {
  if (limit <= 0) return 0
  return Math.min(1, Math.max(0, spent / limit))
}

/** Where the progress bar turns amber. */
export const SPEND_WARNING_THRESHOLD = 0.8

export function isSpendWarning(spent: number, limit: number): boolean {
  return spendRatio(spent, limit) >= SPEND_WARNING_THRESHOLD
}

/** Human labels for the category lock. The stored value is the key. */
export const CARD_CATEGORY_LABELS: Record<CardCategory, string> = {
  subscriptions: "Vendor subscriptions",
  advertising: "Advertising",
  contractor_tools: "Contractor tools",
}
