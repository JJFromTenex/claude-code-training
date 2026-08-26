import { merchantById } from "@/data/merchants"
import { Currency } from "@/data/types"

/**
 * Card number generation and server-side validation.
 *
 * Every generated number starts on the 4242 test BIN and carries a valid
 * Luhn check digit, so nothing here can ever resemble a real PAN.
 */

const BIN = "4242"
const PAN_LENGTH = 16

/** Standard Luhn check digit for a PAN prefix (all digits but the last). */
function luhnCheckDigit(prefix: string): number {
  let sum = 0
  for (let i = 0; i < prefix.length; i++) {
    let digit = Number(prefix[prefix.length - 1 - i])
    // The rightmost prefix digit becomes the second-to-last digit of the
    // full PAN, which Luhn doubles — so doubling starts here, not at i = 1.
    if (i % 2 === 0) {
      digit *= 2
      if (digit > 9) digit -= 9
    }
    sum += digit
  }
  return (10 - (sum % 10)) % 10
}

/** True if a full PAN passes the Luhn checksum. */
export function isValidLuhn(pan: string): boolean {
  let sum = 0
  for (let i = 0; i < pan.length; i++) {
    let digit = Number(pan[pan.length - 1 - i])
    if (i % 2 === 1) {
      digit *= 2
      if (digit > 9) digit -= 9
    }
    sum += digit
  }
  return sum % 10 === 0
}

/** Generates a 16-digit number on the 4242 BIN with a valid Luhn digit. */
export function generateCardNumber(): string {
  let middle = ""
  for (let i = 0; i < PAN_LENGTH - BIN.length - 1; i++) {
    middle += Math.floor(Math.random() * 10)
  }
  const prefix = BIN + middle
  return prefix + String(luhnCheckDigit(prefix))
}

/** `•••• 1234` — the real last four, never the BIN. */
export function maskCardNumber(last4: string): string {
  return `•••• ${last4}`
}

export const MAX_LIMIT_MINOR_UNITS = 5_000_000
const ALLOWED_CURRENCIES: Currency[] = ["USD", "EUR", "GBP"]

export interface IssueCardInput {
  nickname: string
  merchantId: string
  limitMinorUnits: number
  currency: Currency
}

/**
 * Validates a card-issue request against everything the ticket requires
 * rejected: missing merchant, a limit that's zero/negative/over the ceiling,
 * or a currency outside USD/EUR/GBP. The client is not trusted.
 */
export function validateIssueCardInput(
  input: Record<string, unknown>,
): { valid: true; data: IssueCardInput } | { valid: false; error: string } {
  const nickname = typeof input.nickname === "string" ? input.nickname.trim() : ""
  if (!nickname) return { valid: false, error: "Nickname is required." }

  const merchantId = typeof input.merchantId === "string" ? input.merchantId : ""
  if (!merchantId || !merchantById(merchantId)) {
    return { valid: false, error: "Select a valid merchant." }
  }

  const limitMinorUnits = input.limitMinorUnits
  if (
    typeof limitMinorUnits !== "number" ||
    !Number.isInteger(limitMinorUnits) ||
    limitMinorUnits <= 0
  ) {
    return {
      valid: false,
      error: "Spend limit must be a whole number of minor units, greater than zero.",
    }
  }
  if (limitMinorUnits > MAX_LIMIT_MINOR_UNITS) {
    return {
      valid: false,
      error: `Spend limit cannot exceed ${MAX_LIMIT_MINOR_UNITS.toLocaleString()} minor units.`,
    }
  }

  const currency = input.currency
  if (typeof currency !== "string" || !ALLOWED_CURRENCIES.includes(currency as Currency)) {
    return { valid: false, error: "Currency must be USD, EUR, or GBP." }
  }

  return {
    valid: true,
    data: { nickname, merchantId, limitMinorUnits, currency: currency as Currency },
  }
}
