import { Card, CardCategory, CardStatus, Currency } from "@/data/types"

/**
 * Card issuing rules, kept pure so they can be tested without a route.
 *
 * The full card number is deliberately not part of the `Card` record. It is
 * returned once, alongside the record, and the caller is responsible for
 * putting it in exactly one response. Nothing here writes it anywhere.
 */

/** Test BIN. Every generated number starts here, so none can resemble a real PAN. */
export const CARD_BIN = "4242"

const CARD_LENGTH = 16

export const CARD_CATEGORIES: readonly CardCategory[] = [
  "any",
  "advertising",
  "software",
  "contractors",
  "travel",
]

export const CURRENCIES: readonly Currency[] = ["USD", "EUR", "GBP"]

/** A limit above this is refused. 5,000,000 minor units. */
export const MAX_SPEND_LIMIT = 5_000_000

/** Doubles every second digit from the right, summing digits over 9. */
function luhnSum(digits: string): number {
  let sum = 0
  let double = digits.length % 2 === 0
  for (const char of digits) {
    let digit = Number(char)
    if (double) {
      digit *= 2
      if (digit > 9) digit -= 9
    }
    sum += digit
    double = !double
  }
  return sum
}

/** The digit that makes `partial` satisfy Luhn. */
export function luhnCheckDigit(partial: string): number {
  return (10 - (luhnSum(partial + "0") % 10)) % 10
}

export function isLuhnValid(number: string): boolean {
  return luhnSum(number) % 10 === 0
}

/**
 * A full card number on the test BIN with a valid check digit.
 *
 * Server-side only. A number produced in the browser is a bug.
 */
export function generateCardNumber(random: () => number = Math.random): string {
  let body = CARD_BIN
  while (body.length < CARD_LENGTH - 1) {
    body += Math.floor(random() * 10)
  }
  return body + luhnCheckDigit(body)
}

/** `•••• 4242`. How a card number appears anywhere but the creation response. */
export function maskCard(last4: string): string {
  return `•••• ${last4}`
}

/**
 * The state machine. `active ⇄ frozen`, either to `cancelled`, and
 * `cancelled` is terminal.
 */
const TRANSITIONS: Record<CardStatus, readonly CardStatus[]> = {
  active: ["frozen", "cancelled"],
  frozen: ["active", "cancelled"],
  cancelled: [],
}

export function canTransition(from: CardStatus, to: CardStatus): boolean {
  return TRANSITIONS[from].includes(to)
}

export type Result<T> = { ok: true; value: T } | { ok: false; message: string }

/**
 * Guards a status change. Returns the new status or the reason it was
 * refused — never throws, so a route can turn it into a 409.
 */
export function transition(from: CardStatus, to: CardStatus): Result<CardStatus> {
  if (from === to) {
    return { ok: false, message: `Card is already ${from}.` }
  }
  if (from === "cancelled") {
    return { ok: false, message: "A cancelled card cannot change status." }
  }
  if (!canTransition(from, to)) {
    return { ok: false, message: `Cannot move a card from ${from} to ${to}.` }
  }
  return { ok: true, value: to }
}

export interface CardInput {
  nickname: string
  merchantId: string
  spendLimit: number
  currency: Currency
  category: CardCategory
}

/**
 * Validates issue input against an allowlist. The client's own checks are a
 * convenience; this is the enforcement.
 *
 * `spendLimit` arrives already converted to minor units by
 * `parseAmountToMinorUnits` at the boundary — this refuses anything that is
 * not a positive integer within the cap.
 */
export function validateCardInput(
  input: Partial<Record<keyof CardInput, unknown>>,
  merchantIds: readonly string[],
): Result<CardInput> {
  const nickname =
    typeof input.nickname === "string" ? input.nickname.trim() : ""
  if (!nickname) {
    return { ok: false, message: "Give the card a nickname." }
  }
  if (nickname.length > 60) {
    return { ok: false, message: "Nickname must be 60 characters or fewer." }
  }

  if (
    typeof input.merchantId !== "string" ||
    !merchantIds.includes(input.merchantId)
  ) {
    return { ok: false, message: "Choose a merchant for this card." }
  }

  const spendLimit = input.spendLimit
  if (typeof spendLimit !== "number" || !Number.isInteger(spendLimit)) {
    return { ok: false, message: "Spend limit must be an amount like 250.00." }
  }
  if (spendLimit <= 0) {
    return { ok: false, message: "Spend limit must be greater than zero." }
  }
  if (spendLimit > MAX_SPEND_LIMIT) {
    return { ok: false, message: "Spend limit cannot exceed 5,000,000." }
  }

  if (
    typeof input.currency !== "string" ||
    !CURRENCIES.includes(input.currency as Currency)
  ) {
    return { ok: false, message: "Currency must be USD, EUR, or GBP." }
  }

  const category =
    typeof input.category === "string" &&
    CARD_CATEGORIES.includes(input.category as CardCategory)
      ? (input.category as CardCategory)
      : "any"

  return {
    ok: true,
    value: {
      nickname,
      merchantId: input.merchantId,
      spendLimit,
      currency: input.currency as Currency,
      category,
    },
  }
}

/**
 * Builds a card and its number.
 *
 * The number is returned beside the record, never on it, so there is nothing
 * to leak even if the record is spread into a response.
 */
export function issueCard(
  input: CardInput,
  options: { id: string; now: Date; random?: () => number },
): { card: Card; fullNumber: string } {
  const fullNumber = generateCardNumber(options.random)
  const card: Card = {
    id: options.id,
    nickname: input.nickname,
    merchantId: input.merchantId,
    spendLimit: input.spendLimit,
    spent: 0,
    currency: input.currency,
    status: "active",
    category: input.category,
    last4: fullNumber.slice(-4),
    createdAt: options.now.toISOString(),
  }
  return { card, fullNumber }
}

/** Spend as a percentage of the limit, clamped to 0–100. */
export function spendPercent(card: Pick<Card, "spent" | "spendLimit">): number {
  if (card.spendLimit <= 0) return 0
  return Math.min(100, Math.round((card.spent / card.spendLimit) * 100))
}
