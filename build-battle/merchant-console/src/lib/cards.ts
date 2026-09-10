import { merchantById } from "@/data/merchants"
import {
  CardCategory,
  CardStatus,
  Currency,
  IssueCardInput,
} from "@/data/types"
import { formatMoney } from "./money"

/**
 * Everything about a virtual card that has a rule attached, in one place:
 * the test BIN, the Luhn check digit, masking, the spend-limit ceiling, the
 * allowlists, the status state machine, and the request validation.
 *
 * Nothing here touches the store. `src/data/cards.ts` does that.
 */

/** Every generated number starts here, so nothing in this repo can resemble a real PAN. */
export const TEST_BIN = "4242"
export const CARD_NUMBER_LENGTH = 16

/** Integer minor units. 5,000,000 is $50,000.00 or the equivalent. */
export const MAX_SPEND_LIMIT = 5_000_000
export const NICKNAME_MAX_LENGTH = 40

export const CARD_CURRENCIES: readonly Currency[] = ["USD", "EUR", "GBP"]

export const CARD_CATEGORIES: readonly CardCategory[] = [
  "advertising",
  "software",
  "contractors",
  "travel",
  "office",
]

export const CARD_CATEGORY_LABELS: Record<CardCategory, string> = {
  advertising: "Advertising",
  software: "Software & subscriptions",
  contractors: "Contractors",
  travel: "Travel",
  office: "Office supplies",
}

export const CARD_STATUSES: readonly CardStatus[] = [
  "active",
  "frozen",
  "cancelled",
]

// ---------------------------------------------------------------------------
// Numbers
// ---------------------------------------------------------------------------

/**
 * Luhn sum of a digit string, weighting from the right. `offset` is 1 when the
 * string is missing its check digit, so the doubling lands on the same digits
 * it will once the check digit is appended.
 */
function luhnSum(digits: string, offset: 0 | 1): number {
  let sum = 0
  for (let i = 0; i < digits.length; i++) {
    let digit = Number(digits[digits.length - 1 - i])
    if ((i + offset) % 2 === 1) {
      digit *= 2
      if (digit > 9) digit -= 9
    }
    sum += digit
  }
  return sum
}

/** The digit that makes `partial + digit` pass the Luhn check. */
export function luhnCheckDigit(partial: string): string {
  if (!/^\d+$/.test(partial)) {
    throw new Error("Luhn input must be digits only")
  }
  return String((10 - (luhnSum(partial, 1) % 10)) % 10)
}

export function isLuhnValid(number: string): boolean {
  if (!/^\d{2,}$/.test(number)) return false
  return luhnSum(number, 0) % 10 === 0
}

/**
 * A 16-digit number on the test BIN with a valid Luhn check digit.
 * Server-side only. `random` is injectable so seeds and tests are deterministic.
 */
export function generateCardNumber(random: () => number = Math.random): string {
  let partial = TEST_BIN
  while (partial.length < CARD_NUMBER_LENGTH - 1) {
    partial += String(Math.floor(random() * 10) % 10)
  }
  return partial + luhnCheckDigit(partial)
}

/** How a card number appears everywhere except the creation response. */
export function maskCardNumber(last4: string): string {
  return `•••• ${last4}`
}

/** Groups of four for the one-time reveal. Display only. */
export function formatCardNumber(number: string): string {
  return number.replace(/(\d{4})(?=\d)/g, "$1 ")
}

// ---------------------------------------------------------------------------
// Status state machine
// ---------------------------------------------------------------------------

/** active ⇄ frozen, either to cancelled, and cancelled is terminal. */
export const CARD_TRANSITIONS: Record<CardStatus, readonly CardStatus[]> = {
  active: ["frozen", "cancelled"],
  frozen: ["active", "cancelled"],
  cancelled: [],
}

export function canTransition(from: CardStatus, to: CardStatus): boolean {
  return CARD_TRANSITIONS[from].includes(to)
}

export function isCardStatus(value: unknown): value is CardStatus {
  return CARD_STATUSES.includes(value as CardStatus)
}

// ---------------------------------------------------------------------------
// Spend
// ---------------------------------------------------------------------------

/** Whole-number percentage of the limit that has been spent. Display only. */
export function spendPercent(spent: number, limit: number): number {
  if (limit <= 0 || spent <= 0) return 0
  return Math.round((spent * 100) / limit)
}

/** Amber starts past 80%. */
export const SPEND_WARNING_PERCENT = 80

// ---------------------------------------------------------------------------
// Validation. The client is not trusted; every rule lives here.
// ---------------------------------------------------------------------------

export type ParseResult<T> =
  | { ok: true; value: T }
  | { ok: false; error: string }

const fail = (error: string): ParseResult<never> => ({ ok: false, error })

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

/**
 * Turns an unknown request body into a validated `IssueCardInput`, or the
 * first reason it cannot be. Rejects early and returns; each rule is one
 * check, in the order ops fills the form.
 */
export function parseIssueCardInput(body: unknown): ParseResult<IssueCardInput> {
  if (!isRecord(body)) return fail("Request body must be a JSON object.")

  const nickname =
    typeof body.nickname === "string" ? body.nickname.trim() : ""
  if (!nickname) return fail("Give the card a nickname.")
  if (nickname.length > NICKNAME_MAX_LENGTH) {
    return fail(`Nickname must be ${NICKNAME_MAX_LENGTH} characters or fewer.`)
  }

  const merchantId = typeof body.merchantId === "string" ? body.merchantId : ""
  if (!merchantId) return fail("Choose a merchant.")
  if (!merchantById(merchantId)) return fail("That merchant does not exist.")

  const currency = body.currency
  if (!CARD_CURRENCIES.includes(currency as Currency)) {
    return fail("Currency must be USD, EUR, or GBP.")
  }

  const spendLimit = body.spendLimit
  if (typeof spendLimit !== "number" || !Number.isSafeInteger(spendLimit)) {
    return fail("Spend limit must be a whole number of minor units.")
  }
  if (spendLimit <= 0) return fail("Spend limit must be greater than zero.")
  if (spendLimit > MAX_SPEND_LIMIT) {
    return fail(
      `Spend limit cannot exceed ${formatMoney(MAX_SPEND_LIMIT, currency as Currency)}.`,
    )
  }

  const rawCategory = body.categoryLock
  let categoryLock: CardCategory | null = null
  if (rawCategory !== undefined && rawCategory !== null && rawCategory !== "") {
    if (!CARD_CATEGORIES.includes(rawCategory as CardCategory)) {
      return fail("Choose a category from the list.")
    }
    categoryLock = rawCategory as CardCategory
  }

  return {
    ok: true,
    value: {
      nickname,
      merchantId,
      spendLimit,
      currency: currency as Currency,
      categoryLock,
    },
  }
}

/** The body of a status change request: `{ status }` on the allowlist. */
export function parseStatusInput(body: unknown): ParseResult<CardStatus> {
  if (!isRecord(body) || !isCardStatus(body.status)) {
    return fail("Status must be active, frozen, or cancelled.")
  }
  return { ok: true, value: body.status }
}
