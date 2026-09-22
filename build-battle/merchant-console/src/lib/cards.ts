import { CardStatus } from "@/data/types"

/**
 * Virtual-card helpers: number generation, masking, and the status state
 * machine. Pure and server-usable — the number is generated here, never in the
 * browser, and the full PAN never leaves the creation response.
 */

/** Test BIN. Every generated number starts here so nothing resembles a real PAN. */
export const CARD_BIN = "4242"
const PAN_LENGTH = 16

/**
 * The Luhn check digit for a numeric string that does not yet carry one.
 * The appended digit sits at the far right, so the rightmost body digit is the
 * first to double.
 */
export function luhnCheckDigit(body: string): number {
  let sum = 0
  let double = true
  for (let i = body.length - 1; i >= 0; i--) {
    let digit = body.charCodeAt(i) - 48
    if (double) {
      digit *= 2
      if (digit > 9) digit -= 9
    }
    sum += digit
    double = !double
  }
  return (10 - (sum % 10)) % 10
}

/** True when a full number (check digit included) satisfies the Luhn formula. */
export function isLuhnValid(number: string): boolean {
  let sum = 0
  let double = false
  for (let i = number.length - 1; i >= 0; i--) {
    let digit = number.charCodeAt(i) - 48
    if (double) {
      digit *= 2
      if (digit > 9) digit -= 9
    }
    sum += digit
    double = !double
  }
  return sum % 10 === 0
}

/**
 * A 16-digit card number on the 4242 test BIN with a valid Luhn check digit.
 * Server-side only. The caller keeps the last four and discards the rest.
 */
export function generateCardNumber(): string {
  let body = CARD_BIN
  while (body.length < PAN_LENGTH - 1) {
    body += Math.floor(Math.random() * 10)
  }
  return body + luhnCheckDigit(body)
}

/** The masked form shown everywhere except the one-time reveal. */
export function maskCard(last4: string): string {
  return `•••• ${last4}`
}

/**
 * The card status state machine: active ⇄ frozen, either → cancelled, and
 * cancelled is terminal. Enforced on the server, not only in the UI.
 */
const ALLOWED_TRANSITIONS: Record<CardStatus, readonly CardStatus[]> = {
  active: ["frozen", "cancelled"],
  frozen: ["active", "cancelled"],
  cancelled: [],
}

export function canTransition(from: CardStatus, to: CardStatus): boolean {
  return ALLOWED_TRANSITIONS[from].includes(to)
}

/** Spend is flagged once it passes this percent of the limit. */
export const SPEND_ALERT_PERCENT = 80

/** Percent of the limit already spent, clamped to 0–100. Minor units in, no float stored. */
export function spendPercent(spend: number, limit: number): number {
  if (limit <= 0) return 0
  return Math.min(100, (spend / limit) * 100)
}

/** True once spend is strictly past the alert threshold (drives the amber bar). */
export function isSpendHigh(spend: number, limit: number): boolean {
  return spendPercent(spend, limit) > SPEND_ALERT_PERCENT
}
