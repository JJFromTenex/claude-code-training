import { merchantById } from "@/data/merchants"
import { CardCategory, CardStatus, Currency } from "@/data/types"
import { parseAmountToMinorUnits } from "./money"

/**
 * Card number generation, masking, the status state machine, and the
 * server-side validation behind issuing.
 *
 * Every number generated here starts with the 4242 test BIN and carries a
 * valid Luhn check digit, so nothing in this repository can resemble a real
 * PAN. Generation is server-side only — a number produced in the browser is
 * a bug, not a shortcut.
 */

/** The only BIN this repository may ever produce. */
export const TEST_BIN = "4242"
export const CARD_NUMBER_LENGTH = 16

/** Highest limit ops can set, in minor units. */
export const MAX_SPEND_LIMIT = 5_000_000

/** Spend ratio past which the detail view warns. */
export const SPEND_WARNING_RATIO = 0.8

export const CARD_CATEGORIES = [
  "advertising",
  "software",
  "travel",
  "contractors",
  "utilities",
] as const

export const CARD_CURRENCIES = ["USD", "EUR", "GBP"] as const

const NICKNAME_MAX = 60

/**
 * The check digit that makes `partial` Luhn-valid once appended. Doubling
 * starts at the rightmost digit of the partial, because the check digit
 * itself will occupy the position after it.
 */
export function luhnCheckDigit(partial: string): string {
  let sum = 0
  let double = true
  for (let i = partial.length - 1; i >= 0; i--) {
    let digit = Number(partial[i])
    if (double) {
      digit *= 2
      if (digit > 9) digit -= 9
    }
    sum += digit
    double = !double
  }
  return String((10 - (sum % 10)) % 10)
}

export function isLuhnValid(number: string): boolean {
  if (!/^\d+$/.test(number)) return false
  let sum = 0
  let double = false
  for (let i = number.length - 1; i >= 0; i--) {
    let digit = Number(number[i])
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
 * A full test card number: the 4242 BIN, random middle digits, and a Luhn
 * check digit. The RNG is injectable so seed data can be deterministic and
 * tests can pin a number; callers on a request path take the default.
 */
export function generateCardNumber(rand: () => number = Math.random): string {
  let partial = TEST_BIN
  while (partial.length < CARD_NUMBER_LENGTH - 1) {
    partial += String(Math.floor(rand() * 10))
  }
  return partial + luhnCheckDigit(partial)
}

/** The display form everywhere that is not the one-time issue response. */
export function maskCardNumber(last4: string): string {
  return `•••• ${last4}`
}

/** Groups a full number for the reveal screen. Issue response only. */
export function formatCardNumber(number: string): string {
  return number.replace(/(.{4})/g, "$1 ").trim()
}

/**
 * `active ⇄ frozen`, either to `cancelled`, and `cancelled` is terminal.
 * Guarded here so the server enforces it rather than trusting the UI.
 */
const TRANSITIONS: Record<CardStatus, readonly CardStatus[]> = {
  active: ["frozen", "cancelled"],
  frozen: ["active", "cancelled"],
  cancelled: [],
}

export function canTransition(from: CardStatus, to: CardStatus): boolean {
  return TRANSITIONS[from].includes(to)
}

export function nextStatuses(from: CardStatus): readonly CardStatus[] {
  return TRANSITIONS[from]
}

export interface IssueCardInput {
  nickname: string
  merchantId: string
  /** Integer minor units. */
  spendLimit: number
  currency: Currency
  categoryLock: CardCategory | null
}

export type Validated<T> =
  | { ok: true; value: T }
  | { ok: false; error: string }

/**
 * Validates an issue request. Everything arrives from the client and nothing
 * is trusted: the merchant must exist, the currency must be one we support,
 * and the limit is parsed from its string form exactly once, here, at the
 * boundary. Rejects early rather than collecting errors, so no case goes
 * missing in a nest of branches.
 *
 * `spendLimit` is a string ("250", "250.00") on purpose. A bare number is
 * ambiguous about its units, and guessing is how cents go missing.
 */
export function validateIssueCard(body: unknown): Validated<IssueCardInput> {
  if (typeof body !== "object" || body === null) {
    return { ok: false, error: "Expected an object." }
  }
  const input = body as Record<string, unknown>

  const rawNickname = input.nickname
  if (typeof rawNickname !== "string" || rawNickname.trim() === "") {
    return { ok: false, error: "Give the card a nickname." }
  }
  const nickname = rawNickname.trim()
  if (nickname.length > NICKNAME_MAX) {
    return {
      ok: false,
      error: `Nickname must be ${NICKNAME_MAX} characters or fewer.`,
    }
  }

  const merchantId = input.merchantId
  if (typeof merchantId !== "string" || merchantId === "") {
    return { ok: false, error: "Choose a merchant." }
  }
  if (!merchantById(merchantId)) {
    return { ok: false, error: "That merchant does not exist." }
  }

  const rawLimit = input.spendLimit
  if (typeof rawLimit !== "string" || rawLimit.trim() === "") {
    return { ok: false, error: "Set a spend limit." }
  }
  const spendLimit = parseAmountToMinorUnits(rawLimit)
  if (spendLimit === null) {
    return {
      ok: false,
      error: "Spend limit must be an amount like 250 or 250.00.",
    }
  }
  if (spendLimit <= 0) {
    return { ok: false, error: "Spend limit must be more than zero." }
  }
  if (spendLimit > MAX_SPEND_LIMIT) {
    return {
      ok: false,
      error: "Spend limit must be 50,000.00 or less.",
    }
  }

  const currency = input.currency
  if (
    typeof currency !== "string" ||
    !(CARD_CURRENCIES as readonly string[]).includes(currency)
  ) {
    return { ok: false, error: "Currency must be USD, EUR, or GBP." }
  }

  const rawCategory = input.categoryLock
  let categoryLock: CardCategory | null = null
  if (rawCategory !== undefined && rawCategory !== null && rawCategory !== "") {
    if (
      typeof rawCategory !== "string" ||
      !(CARD_CATEGORIES as readonly string[]).includes(rawCategory)
    ) {
      return { ok: false, error: "That category is not one we support." }
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

/** Validates a requested status against the allowlist, before the machine. */
export function parseCardStatus(value: unknown): CardStatus | null {
  return value === "active" || value === "frozen" || value === "cancelled"
    ? value
    : null
}
