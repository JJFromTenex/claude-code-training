import { merchantById } from "@/data/merchants"
import {
  Card,
  CardCategory,
  CardStatus,
  Currency,
} from "@/data/types"

/**
 * Virtual card rules.
 *
 * Number generation, masking, and the status state machine live here as pure
 * functions so the route handlers stay thin and every rule is unit-testable.
 * Nothing in this file may produce something resembling a real PAN.
 */

/** Test BIN. Every generated number starts with it, without exception. */
export const CARD_BIN = "4242"

export const CARD_NUMBER_LENGTH = 16

/** Ceiling from the ticket: a limit above this is rejected. Minor units. */
export const MAX_SPEND_LIMIT_MINOR = 5_000_000

export const CARD_STATUSES = ["active", "frozen", "cancelled"] as const

export const CARD_CATEGORIES: readonly CardCategory[] = [
  "advertising",
  "software",
  "travel",
  "contractors",
  "utilities",
]

export const CURRENCIES: readonly Currency[] = ["USD", "EUR", "GBP"]

const NICKNAME_MAX = 60

/**
 * The check digit that makes `payload` pass a Luhn check.
 * The digit lands to the right of the payload, so the payload's own rightmost
 * digit is the first one doubled.
 */
export function luhnCheckDigit(payload: string): number {
  let sum = 0
  let double = true
  for (let i = payload.length - 1; i >= 0; i--) {
    let digit = payload.charCodeAt(i) - 48
    if (double) {
      digit *= 2
      if (digit > 9) digit -= 9
    }
    sum += digit
    double = !double
  }
  return (10 - (sum % 10)) % 10
}

export function isLuhnValid(cardNumber: string): boolean {
  if (!/^\d{2,}$/.test(cardNumber)) return false
  return luhnCheckDigit(cardNumber.slice(0, -1)) === Number(cardNumber.slice(-1))
}

/**
 * A 16-digit number on the test BIN with a valid check digit.
 * Server-side only — a number generated in the browser is a bug.
 * `random` is injectable so tests can pin a number without stubbing globals.
 */
export function generateCardNumber(random: () => number = Math.random): string {
  let payload = CARD_BIN
  while (payload.length < CARD_NUMBER_LENGTH - 1) {
    payload += Math.floor(random() * 10)
  }
  return payload + luhnCheckDigit(payload)
}

/** Opaque handle for a generated number. Not the number, and not derived from it. */
export function generateCardReference(random: () => number = Math.random): string {
  let ref = ""
  while (ref.length < 12) ref += Math.floor(random() * 16).toString(16)
  return `cref_${ref}`
}

/** How a card is shown everywhere except the one-time creation response. */
export function maskCardNumber(last4: string): string {
  return `•••• ${last4}`
}

/**
 * `active ⇄ frozen`, either to `cancelled`, and `cancelled` is terminal.
 * Guarded here so the server enforces it and the UI merely reflects it.
 */
const TRANSITIONS: Record<CardStatus, readonly CardStatus[]> = {
  active: ["frozen", "cancelled"],
  frozen: ["active", "cancelled"],
  cancelled: [],
}

export function allowedTransitions(from: CardStatus): readonly CardStatus[] {
  return TRANSITIONS[from]
}

export function canTransition(from: CardStatus, to: CardStatus): boolean {
  return TRANSITIONS[from].includes(to)
}

export function isCardStatus(value: unknown): value is CardStatus {
  return (CARD_STATUSES as readonly unknown[]).includes(value)
}

/** Spend against limit as a 0-1 ratio. Guards a zero limit rather than dividing by it. */
export function spendRatio(card: Pick<Card, "spent" | "spendLimit">): number {
  if (card.spendLimit <= 0) return 0
  return Math.min(card.spent / card.spendLimit, 1)
}

export interface IssueCardInput {
  nickname: string
  merchantId: string
  spendLimit: number
  currency: Currency
  category: CardCategory | null
}

export type ValidationResult =
  | { ok: true; value: IssueCardInput }
  | { ok: false; message: string }

/**
 * Every field an issue request carries, checked against an allowlist before it
 * reaches the store. The client's own checks are convenience, never enforcement.
 * Returns the first problem rather than a list, so the caller can reject early.
 */
export function validateIssueRequest(body: unknown): ValidationResult {
  if (typeof body !== "object" || body === null) {
    return { ok: false, message: "Expected a JSON object." }
  }
  const input = body as Record<string, unknown>

  const nickname = typeof input.nickname === "string" ? input.nickname.trim() : ""
  if (!nickname) {
    return { ok: false, message: "Give the card a nickname." }
  }
  if (nickname.length > NICKNAME_MAX) {
    return { ok: false, message: `Nickname must be ${NICKNAME_MAX} characters or fewer.` }
  }

  const merchantId = typeof input.merchantId === "string" ? input.merchantId : ""
  if (!merchantId || !merchantById(merchantId)) {
    return { ok: false, message: "Choose a merchant." }
  }

  const spendLimit = input.spendLimit
  if (typeof spendLimit !== "number" || !Number.isInteger(spendLimit)) {
    return { ok: false, message: "Spend limit must be an integer number of minor units." }
  }
  if (spendLimit <= 0) {
    return { ok: false, message: "Spend limit must be greater than zero." }
  }
  if (spendLimit > MAX_SPEND_LIMIT_MINOR) {
    return { ok: false, message: "Spend limit must be 5,000,000 minor units or less." }
  }

  const currency = input.currency
  if (!CURRENCIES.includes(currency as Currency)) {
    return { ok: false, message: "Currency must be one of USD, EUR, or GBP." }
  }

  const rawCategory = input.category
  let category: CardCategory | null = null
  if (rawCategory !== undefined && rawCategory !== null && rawCategory !== "") {
    if (!CARD_CATEGORIES.includes(rawCategory as CardCategory)) {
      return { ok: false, message: "That merchant category is not one we issue against." }
    }
    category = rawCategory as CardCategory
  }

  return {
    ok: true,
    value: { nickname, merchantId, spendLimit, currency: currency as Currency, category },
  }
}
