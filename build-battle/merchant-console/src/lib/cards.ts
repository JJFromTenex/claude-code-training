import { CardCategory, CardStatus } from "@/data/types"

/**
 * All card numbers we generate start with the test BIN. Nothing in this repo
 * may ever resemble a real PAN. Callers do not choose the prefix.
 */
const TEST_BIN = "4242"

const CARD_NUMBER_LENGTH = 16

export const CARD_CATEGORIES = [
  "retail",
  "marketplace",
  "subscription",
  "services",
] as const satisfies readonly CardCategory[]

const CARD_STATUSES: readonly CardStatus[] = ["active", "frozen", "cancelled"]

/**
 * Luhn check on the full digit string, including the check digit. Empty and
 * non-digit strings are invalid.
 */
export function isValidLuhn(digits: string): boolean {
  if (!/^\d+$/.test(digits)) return false
  let sum = 0
  let double = false
  for (let i = digits.length - 1; i >= 0; i--) {
    let n = digits.charCodeAt(i) - 48
    if (double) {
      n *= 2
      if (n > 9) n -= 9
    }
    sum += n
    double = !double
  }
  return sum % 10 === 0
}

function luhnCheckDigit(withoutCheck: string): number {
  let sum = 0
  let double = true
  for (let i = withoutCheck.length - 1; i >= 0; i--) {
    let n = withoutCheck.charCodeAt(i) - 48
    if (double) {
      n *= 2
      if (n > 9) n -= 9
    }
    sum += n
    double = !double
  }
  return (10 - (sum % 10)) % 10
}

/**
 * Generate a 16-digit card number on the 4242 BIN with a valid Luhn check
 * digit. Server-only; a card number produced in the browser is a bug.
 */
export function generateCardNumber(): string {
  const body = TEST_BIN
  const randomLength = CARD_NUMBER_LENGTH - body.length - 1
  let mid = ""
  for (let i = 0; i < randomLength; i++) {
    mid += Math.floor(Math.random() * 10).toString()
  }
  const check = luhnCheckDigit(body + mid)
  return `${body}${mid}${check}`
}

export function mask(last4: string): string {
  return `•••• ${last4}`
}

/**
 * State machine: active ⇄ frozen, either → cancelled, cancelled is terminal.
 * Guard on the server, not only in the UI.
 */
export function canTransition(from: CardStatus, to: CardStatus): boolean {
  if (!CARD_STATUSES.includes(from) || !CARD_STATUSES.includes(to)) return false
  if (from === to) return false
  if (from === "cancelled") return false
  return true
}
