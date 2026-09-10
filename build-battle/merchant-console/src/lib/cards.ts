import { randomInt, randomUUID } from "node:crypto"
import { merchantById } from "@/data/merchants"
import { CardStatus, Currency } from "@/data/types"

/**
 * Every card rule lives here so the route handlers stay thin and the rules
 * are testable without Next. Nothing in this file may produce anything that
 * resembles a real PAN: the test BIN is fixed and not configurable.
 */

export const TEST_BIN = "4242"
export const CARD_NUMBER_LENGTH = 16
export const CURRENCIES: readonly Currency[] = ["USD", "EUR", "GBP"]
export const CARD_STATUSES: readonly CardStatus[] = ["active", "frozen", "cancelled"]
/** Integer minor units. 5,000,000 is 50,000.00 in any of the three currencies. */
export const MAX_SPEND_LIMIT = 5_000_000
export const MAX_NICKNAME_LENGTH = 40

/** Luhn check digit for a digit string that does not yet carry one. */
export function luhnCheckDigit(partial: string): number {
  let sum = 0
  // Walk right to left. The rightmost digit of the partial is doubled because
  // the check digit will sit to its right once appended.
  for (let i = partial.length - 1, double = true; i >= 0; i--, double = !double) {
    let digit = Number(partial[i])
    if (double) {
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

/** A 16-digit number on the test BIN with a valid check digit. Server only. */
export function generateCardNumber(): string {
  let partial = TEST_BIN
  while (partial.length < CARD_NUMBER_LENGTH - 1) partial += String(randomInt(10))
  return partial + luhnCheckDigit(partial)
}

/** Opaque reference stored in place of the number. */
export function newNumberRef(): string {
  return `cnum_${randomUUID().replace(/-/g, "").slice(0, 20)}`
}

/** The only way a card number is ever shown after creation. */
export function maskCard(last4: string): string {
  return `•••• ${last4}`
}

export interface IssueCardInput {
  nickname: string
  merchantId: string
  /** Integer minor units. */
  spendLimit: number
  currency: Currency
}

export type Validation<T> =
  | { ok: true; value: T }
  | { ok: false; field: keyof T | "body"; message: string }

/**
 * Validates a client-supplied issue request. The client is not trusted: every
 * field is checked against an allowlist or a range before it reaches the store.
 */
export function validateIssueRequest(body: unknown): Validation<IssueCardInput> {
  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    return { ok: false, field: "body", message: "Request body must be an object." }
  }
  const { nickname, merchantId, spendLimit, currency } = body as Record<string, unknown>

  if (typeof nickname !== "string" || nickname.trim().length === 0) {
    return { ok: false, field: "nickname", message: "Nickname is required." }
  }
  if (nickname.trim().length > MAX_NICKNAME_LENGTH) {
    return {
      ok: false,
      field: "nickname",
      message: `Nickname must be ${MAX_NICKNAME_LENGTH} characters or fewer.`,
    }
  }
  if (typeof merchantId !== "string" || merchantId.length === 0) {
    return { ok: false, field: "merchantId", message: "Merchant is required." }
  }
  if (!merchantById(merchantId)) {
    return { ok: false, field: "merchantId", message: "Merchant not found." }
  }
  if (typeof spendLimit !== "number" || !Number.isInteger(spendLimit)) {
    return {
      ok: false,
      field: "spendLimit",
      message: "Spend limit must be a whole number of minor units.",
    }
  }
  if (spendLimit <= 0) {
    return { ok: false, field: "spendLimit", message: "Spend limit must be greater than zero." }
  }
  if (spendLimit > MAX_SPEND_LIMIT) {
    return {
      ok: false,
      field: "spendLimit",
      message: `Spend limit cannot exceed ${MAX_SPEND_LIMIT.toLocaleString("en-US")} minor units.`,
    }
  }
  if (typeof currency !== "string" || !CURRENCIES.includes(currency as Currency)) {
    return { ok: false, field: "currency", message: "Currency must be USD, EUR, or GBP." }
  }

  return {
    ok: true,
    value: {
      nickname: nickname.trim(),
      merchantId,
      spendLimit,
      currency: currency as Currency,
    },
  }
}

/** active ⇄ frozen, either to cancelled, and cancelled is terminal. */
const TRANSITIONS: Record<CardStatus, readonly CardStatus[]> = {
  active: ["frozen", "cancelled"],
  frozen: ["active", "cancelled"],
  cancelled: [],
}

export function isCardStatus(value: unknown): value is CardStatus {
  return CARD_STATUSES.includes(value as CardStatus)
}

export function canTransition(from: CardStatus, to: CardStatus): boolean {
  return TRANSITIONS[from].includes(to)
}
