import { CardStatus } from "@/data/types"

/**
 * Virtual card domain rules: number generation, masking, and the status
 * state machine.
 *
 * Numbers are generated server-side only, on the 4242 test BIN, so nothing
 * in this repository can ever resemble a real PAN. The full number exists
 * exactly once, in the creation response; the store keeps the last four.
 */

/** Every generated number starts with this. Not optional. */
export const TEST_BIN = "4242"

/** Spend limits above this are rejected at the API boundary. Minor units. */
export const MAX_SPEND_LIMIT = 5_000_000

/** Merchant categories a card can be locked to at issue time. */
export const CARD_CATEGORIES = [
  "advertising",
  "software",
  "travel",
  "contractors",
  "office",
] as const

export type CardCategory = (typeof CARD_CATEGORIES)[number]

/**
 * Luhn check digit for a number missing its final digit. The rightmost
 * digit of `partial` sits second-from-right in the full number, so it is
 * the first to be doubled.
 */
export function luhnCheckDigit(partial: string): number {
  let sum = 0
  const digits = partial.split("").reverse().map(Number)
  for (let i = 0; i < digits.length; i++) {
    let digit = digits[i]
    if (i % 2 === 0) {
      digit *= 2
      if (digit > 9) digit -= 9
    }
    sum += digit
  }
  return (10 - (sum % 10)) % 10
}

export function isLuhnValid(number: string): boolean {
  if (!/^\d{2,}$/.test(number)) return false
  return luhnCheckDigit(number.slice(0, -1)) === Number(number.slice(-1))
}

/**
 * 16 digits: the 4242 test BIN, 11 generated digits, and a Luhn check
 * digit. `rand` is injectable so seed data and tests stay deterministic.
 */
export function generateCardNumber(rand: () => number = Math.random): string {
  let partial = TEST_BIN
  for (let i = 0; i < 11; i++) {
    partial += Math.floor(rand() * 10)
  }
  return partial + luhnCheckDigit(partial)
}

/** The only way a card number appears outside the creation response. */
export function maskCard(last4: string): string {
  return `•••• ${last4}`
}

export type CardAction = "freeze" | "unfreeze" | "cancel"

/** `cancelled` has no outgoing edges: it is terminal by design. */
const TRANSITIONS: Record<CardStatus, Partial<Record<CardAction, CardStatus>>> = {
  active: { freeze: "frozen", cancel: "cancelled" },
  frozen: { unfreeze: "active", cancel: "cancelled" },
  cancelled: {},
}

export function nextStatus(
  current: CardStatus,
  action: CardAction,
): CardStatus | null {
  return TRANSITIONS[current][action] ?? null
}
