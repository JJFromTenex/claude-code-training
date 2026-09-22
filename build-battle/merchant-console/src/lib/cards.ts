import { Card, CardStatus, Currency } from "@/data/types"

/**
 * Virtual card rules.
 *
 * Numbers are generated here and nowhere else, always on the 4242 test BIN,
 * so nothing this repository produces can resemble a real PAN. The generated
 * number is returned to exactly one caller and never stored: a card record
 * keeps the last four and an opaque reference.
 */

export const TEST_BIN = "4242"
export const CARD_CURRENCIES: readonly Currency[] = ["USD", "EUR", "GBP"]

/** 5,000,000 minor units. The ticket's cap, inclusive. */
export const MAX_SPEND_LIMIT = 5_000_000

/** Luhn check digit for a partial number, which is every digit but the last. */
export function luhnCheckDigit(partial: string): number {
  let sum = 0
  // The check digit will sit at the end, so the rightmost digit of `partial`
  // is in a doubled position.
  let double = true
  for (let i = partial.length - 1; i >= 0; i--) {
    let digit = partial.charCodeAt(i) - 48
    if (double) {
      digit *= 2
      if (digit > 9) digit -= 9
    }
    sum += digit
    double = !double
  }
  return (10 - (sum % 10)) % 10
}

export function isLuhnValid(number: string): boolean {
  if (!/^\d+$/.test(number)) return false
  return luhnCheckDigit(number.slice(0, -1)) === Number(number.slice(-1))
}

/**
 * A 16-digit test card number. `random` is injectable so tests can pin the
 * body and still assert on the check digit.
 */
export function generateCardNumber(random: () => number = Math.random): string {
  let body = TEST_BIN
  while (body.length < 15) {
    body += String(Math.floor(random() * 10))
  }
  return body + String(luhnCheckDigit(body))
}

export function maskCardNumber(last4: string): string {
  return `•••• ${last4}`
}

/** Opaque stand-in for an issuer token. Never derived from the number. */
export function generateCardReference(random: () => number = Math.random): string {
  let suffix = ""
  while (suffix.length < 12) {
    suffix += Math.floor(random() * 36).toString(36)
  }
  return `cardref_${suffix.slice(0, 12)}`
}

const TRANSITIONS: Record<CardStatus, readonly CardStatus[]> = {
  active: ["frozen", "cancelled"],
  frozen: ["active", "cancelled"],
  cancelled: [],
}

export function canTransition(from: CardStatus, to: CardStatus): boolean {
  return TRANSITIONS[from].includes(to)
}

export type TransitionCheck =
  | { ok: true; status: CardStatus }
  | { ok: false; message: string }

/** The server-side gate on a status change. `to` arrives from the client. */
export function checkTransition(from: CardStatus, to: unknown): TransitionCheck {
  if (typeof to !== "string" || !(to in TRANSITIONS)) {
    return { ok: false, message: "That card status is not recognized." }
  }
  const next = to as CardStatus
  if (from === "cancelled") {
    return { ok: false, message: "A cancelled card cannot change status." }
  }
  if (from === next) {
    return { ok: false, message: `This card is already ${next}.` }
  }
  if (!canTransition(from, next)) {
    return { ok: false, message: "That status change is not allowed." }
  }
  return { ok: true, status: next }
}

export type IssueCheck =
  | {
      ok: true
      nickname: string
      merchantId: string
      spendLimit: number
      currency: Currency
    }
  | { ok: false; message: string }

/**
 * The server-side gate on issuing. Every field arrives from the client and is
 * typed `unknown` on purpose: this is where they stop being untrusted.
 */
export function checkIssue({
  nickname,
  merchantId,
  spendLimit,
  currency,
  merchantExists,
}: {
  nickname: unknown
  merchantId: unknown
  spendLimit: unknown
  currency: unknown
  merchantExists: (id: string) => boolean
}): IssueCheck {
  if (typeof nickname !== "string" || nickname.trim() === "") {
    return { ok: false, message: "Give the card a nickname." }
  }
  if (nickname.trim().length > 60) {
    return { ok: false, message: "That nickname is too long." }
  }
  if (typeof merchantId !== "string" || !merchantExists(merchantId)) {
    return { ok: false, message: "Choose a merchant for this card." }
  }
  if (
    typeof spendLimit !== "number" ||
    !Number.isInteger(spendLimit) ||
    spendLimit <= 0
  ) {
    return { ok: false, message: "Set a spend limit greater than zero." }
  }
  if (spendLimit > MAX_SPEND_LIMIT) {
    return { ok: false, message: "That spend limit is above the cap." }
  }
  if (!CARD_CURRENCIES.includes(currency as Currency)) {
    return { ok: false, message: "That currency is not supported." }
  }
  return {
    ok: true,
    nickname: nickname.trim(),
    merchantId,
    spendLimit,
    currency: currency as Currency,
  }
}

/** Share of the limit already spent, 0-1. Guards a zero limit. */
export function spendRatio(card: Pick<Card, "spent" | "spendLimit">): number {
  if (card.spendLimit <= 0) return 0
  return Math.min(1, card.spent / card.spendLimit)
}
