import { CardStatus, Currency } from "@/data/types"

/**
 * Virtual card rules (NWP-201).
 *
 * Numbers are generated here, on the server, on the 4242 test BIN with a valid
 * Luhn check digit — nothing in this repository may resemble a real PAN. The
 * full number is returned by the creation response and nowhere else; every
 * other surface gets the last four.
 */

/** Test BIN. Every generated number starts with it. */
export const CARD_BIN = "4242"

export const CARD_NUMBER_LENGTH = 16

/** Ceiling on a spend limit, in minor units. $50,000.00. */
export const MAX_SPEND_LIMIT = 5_000_000

export const CARD_CURRENCIES: readonly Currency[] = ["USD", "EUR", "GBP"]

export const NICKNAME_MAX_LENGTH = 48

/** What a card may be locked to at issue time. Optional. */
export const CATEGORY_LOCKS = [
  "advertising",
  "software",
  "travel",
  "office_supplies",
  "contractors",
] as const

export type CategoryLock = (typeof CATEGORY_LOCKS)[number]

export const CATEGORY_LOCK_LABELS: Record<CategoryLock, string> = {
  advertising: "Advertising",
  software: "Software",
  travel: "Travel",
  office_supplies: "Office supplies",
  contractors: "Contractors",
}

/**
 * Sum the digits Luhn-style, right to left.
 *
 * `doubleFromRight` says whether the rightmost digit is one of the doubled
 * ones. Validating a complete number leaves the check digit alone, so it is
 * false; computing a check digit for a partial number shifts everything one
 * place left, so it is true.
 */
function luhnSum(digits: string, doubleFromRight: boolean): number {
  let sum = 0
  let double = doubleFromRight
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

/** The digit that makes `partial` pass Luhn once appended. */
export function luhnCheckDigit(partial: string): number {
  return (10 - (luhnSum(partial, true) % 10)) % 10
}

export function isLuhnValid(cardNumber: string): boolean {
  if (!/^\d+$/.test(cardNumber)) return false
  return luhnSum(cardNumber, false) % 10 === 0
}

/**
 * A 16-digit number on the test BIN with a valid check digit.
 *
 * `random` is injectable so tests can pin the output; production uses
 * `Math.random`, which is fine because nothing here is a real credential.
 */
export function generateCardNumber(random: () => number = Math.random): string {
  let body = CARD_BIN
  while (body.length < CARD_NUMBER_LENGTH - 1) {
    body += Math.floor(random() * 10)
  }
  return body + luhnCheckDigit(body)
}

export function lastFour(cardNumber: string): string {
  return cardNumber.slice(-4)
}

/** How a card number is written anywhere other than the creation response. */
export function maskCardNumber(last4: string): string {
  return `•••• ${last4}`
}

/**
 * Status is a state machine: active ⇄ frozen, either to cancelled, and
 * cancelled is terminal. Guarded here so it holds for every caller, not just
 * the ones that go through the UI.
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

export interface CardIssueInput {
  nickname: string
  merchantId: string
  spendLimit: number
  currency: Currency
  categoryLock: CategoryLock | null
}

export type ValidationResult =
  | { ok: true; value: CardIssueInput }
  | { ok: false; errors: Record<string, string> }

/**
 * Validate an issue request against the allowlists.
 *
 * Pure, so it can be tested without a store: the caller passes the merchant ids
 * that currently exist. Every field is checked — the client is a convenience,
 * never the enforcement.
 */
export function validateIssueInput(
  raw: unknown,
  merchantIds: readonly string[],
): ValidationResult {
  const errors: Record<string, string> = {}
  const body = (raw ?? {}) as Record<string, unknown>

  const nickname = typeof body.nickname === "string" ? body.nickname.trim() : ""
  if (!nickname) {
    errors.nickname = "Give the card a nickname."
  } else if (nickname.length > NICKNAME_MAX_LENGTH) {
    errors.nickname = `Keep the nickname under ${NICKNAME_MAX_LENGTH} characters.`
  }

  const merchantId = typeof body.merchantId === "string" ? body.merchantId : ""
  if (!merchantId) {
    errors.merchantId = "Choose a merchant."
  } else if (!merchantIds.includes(merchantId)) {
    errors.merchantId = "That merchant does not exist."
  }

  const spendLimit = body.spendLimit
  if (typeof spendLimit !== "number" || !Number.isInteger(spendLimit)) {
    errors.spendLimit = "Enter a spend limit."
  } else if (spendLimit <= 0) {
    errors.spendLimit = "The spend limit must be more than zero."
  } else if (spendLimit > MAX_SPEND_LIMIT) {
    errors.spendLimit = "The spend limit cannot exceed 50,000.00."
  }

  const currency = body.currency
  if (!CARD_CURRENCIES.includes(currency as Currency)) {
    errors.currency = "Choose USD, EUR, or GBP."
  }

  let categoryLock: CategoryLock | null = null
  if (body.categoryLock !== undefined && body.categoryLock !== null && body.categoryLock !== "") {
    if (!CATEGORY_LOCKS.includes(body.categoryLock as CategoryLock)) {
      errors.categoryLock = "That category is not one we lock to."
    } else {
      categoryLock = body.categoryLock as CategoryLock
    }
  }

  if (Object.keys(errors).length > 0) return { ok: false, errors }

  return {
    ok: true,
    value: {
      nickname,
      merchantId,
      spendLimit: spendLimit as number,
      currency: currency as Currency,
      categoryLock,
    },
  }
}

/** Spend as a percentage of the limit, clamped to 0–100 for display. */
export function spendPercent(spent: number, spendLimit: number): number {
  if (spendLimit <= 0) return 0
  return Math.min(100, Math.max(0, Math.round((spent / spendLimit) * 100)))
}

/** Past this share of the limit the progress bar warns. */
export const SPEND_WARN_PERCENT = 80
