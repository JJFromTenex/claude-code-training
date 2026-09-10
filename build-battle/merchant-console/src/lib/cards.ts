import { CardStatus, Currency } from "@/data/types"
import { isCurrency } from "./money"

/**
 * Virtual card numbers, masking, and the status state machine.
 *
 * Numbers are generated here — on the server — and never in the browser. Every
 * number starts with the 4242 test BIN and carries a valid Luhn check digit, so
 * nothing in this repository can resemble a real PAN.
 */

/** The test BIN. Not optional: every generated number starts with it. */
export const CARD_BIN = "4242"

export const CARD_NUMBER_LENGTH = 16

/** Spend limits are integer minor units. 5,000,000 is £/$/€50,000.00. */
export const MAX_SPEND_LIMIT = 5_000_000

export const MAX_NICKNAME_LENGTH = 64

function luhnSum(digits: string): number {
  let sum = 0
  let double = false
  for (let i = digits.length - 1; i >= 0; i--) {
    let digit = digits.charCodeAt(i) - 48
    if (double) {
      digit *= 2
      if (digit > 9) digit -= 9
    }
    sum += digit
    double = !double
  }
  return sum
}

/** The check digit that completes `payload` into a Luhn-valid number. */
export function luhnCheckDigit(payload: string): number {
  return (10 - (luhnSum(`${payload}0`) % 10)) % 10
}

export function isLuhnValid(cardNumber: string): boolean {
  return cardNumber.length > 0 && luhnSum(cardNumber) % 10 === 0
}

/**
 * A 16-digit test card number: the 4242 BIN, eleven random digits, and a Luhn
 * check digit. The caller may pass a deterministic source for seed data.
 */
export function generateCardNumber(random: () => number = Math.random): string {
  let payload = CARD_BIN
  while (payload.length < CARD_NUMBER_LENGTH - 1) {
    payload += Math.floor(random() * 10)
  }
  return `${payload}${luhnCheckDigit(payload)}`
}

export function lastFour(cardNumber: string): string {
  return cardNumber.slice(-4)
}

/** How a card number appears anywhere that is not the one-time reveal. */
export function maskCardNumber(last4: string): string {
  return `•••• ${last4}`
}

/** Group a full number for the reveal screen: 4242 1234 5678 9010. */
export function formatCardNumber(cardNumber: string): string {
  return cardNumber.replace(/(.{4})/g, "$1 ").trim()
}

/**
 * Status is a state machine: active ⇄ frozen, either to cancelled, and
 * cancelled is terminal. Guarded here so the server enforces it, not the UI.
 */
const TRANSITIONS: Record<CardStatus, readonly CardStatus[]> = {
  active: ["frozen", "cancelled"],
  frozen: ["active", "cancelled"],
  cancelled: [],
}

export const CARD_STATUSES = ["active", "frozen", "cancelled"] as const

export function isCardStatus(value: string): value is CardStatus {
  return (CARD_STATUSES as readonly string[]).includes(value)
}

export function canTransition(from: CardStatus, to: CardStatus): boolean {
  return TRANSITIONS[from].includes(to)
}

/** A validated, ready-to-issue card request. */
export interface CardDraft {
  nickname: string
  merchantId: string
  spendLimit: number
  currency: Currency
}

export type ValidationResult =
  | { ok: true; value: CardDraft }
  | { ok: false; message: string }

/**
 * Validate an issue request. Everything here arrives from the client, so each
 * field is checked against a rule or an allowlist before it reaches the store.
 * Rejects early and returns the first problem, in language safe to show ops.
 */
export function parseCardDraft(
  input: unknown,
  merchantExists: (id: string) => boolean,
): ValidationResult {
  if (typeof input !== "object" || input === null) {
    return { ok: false, message: "Expected a card to issue." }
  }
  const body = input as Record<string, unknown>

  const nickname =
    typeof body.nickname === "string" ? body.nickname.trim() : ""
  if (!nickname) {
    return { ok: false, message: "Give the card a nickname." }
  }
  if (nickname.length > MAX_NICKNAME_LENGTH) {
    return {
      ok: false,
      message: `Nicknames are ${MAX_NICKNAME_LENGTH} characters or fewer.`,
    }
  }

  const merchantId =
    typeof body.merchantId === "string" ? body.merchantId.trim() : ""
  if (!merchantId) {
    return { ok: false, message: "Choose a merchant for this card." }
  }
  if (!merchantExists(merchantId)) {
    return { ok: false, message: "That merchant does not exist." }
  }

  const spendLimit = body.spendLimit
  if (typeof spendLimit !== "number" || !Number.isInteger(spendLimit)) {
    return {
      ok: false,
      message: "The spend limit must be a whole number of minor units.",
    }
  }
  if (spendLimit <= 0) {
    return { ok: false, message: "The spend limit must be greater than zero." }
  }
  if (spendLimit > MAX_SPEND_LIMIT) {
    return {
      ok: false,
      message: `The spend limit cannot exceed ${MAX_SPEND_LIMIT} minor units.`,
    }
  }

  const currency = typeof body.currency === "string" ? body.currency : ""
  if (!isCurrency(currency)) {
    return { ok: false, message: "Choose USD, EUR, or GBP." }
  }

  return { ok: true, value: { nickname, merchantId, spendLimit, currency } }
}
