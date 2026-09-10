import { Card, CardStatus, Currency, MerchantCategory } from "@/data/types"

/**
 * Virtual card numbers, masking, and the status state machine.
 *
 * Numbers are generated here and nowhere else — never in the browser. Every
 * number sits on the 4242 test BIN with a valid Luhn check digit, so nothing
 * in this repository can resemble a real PAN.
 */

export const TEST_BIN = "4242"
export const CARD_NUMBER_LENGTH = 16

/** The ceiling ops can issue against, in minor units. */
export const MAX_SPEND_LIMIT = 5_000_000

export const CARD_CURRENCIES: readonly Currency[] = ["USD", "EUR", "GBP"]

export const MERCHANT_CATEGORIES: readonly MerchantCategory[] = [
  "advertising",
  "software",
  "travel",
  "contractors",
  "utilities",
]

/** The digit that makes `partial` a Luhn-valid number once appended. */
export function luhnCheckDigit(partial: string): number {
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
  return (10 - (sum % 10)) % 10
}

export function isLuhnValid(cardNumber: string): boolean {
  if (!/^\d+$/.test(cardNumber)) return false
  let sum = 0
  let double = false
  for (let i = cardNumber.length - 1; i >= 0; i--) {
    let digit = Number(cardNumber[i])
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
 * A full card number on the test BIN.
 *
 * Takes its randomness as an argument so seed data can generate the same
 * cards on every machine while issued cards stay unpredictable.
 */
export function generateCardNumber(random: () => number = Math.random): string {
  let body = TEST_BIN
  while (body.length < CARD_NUMBER_LENGTH - 1) {
    body += Math.floor(random() * 10)
  }
  return body + luhnCheckDigit(body)
}

/** What a card number looks like everywhere except the creation response. */
export function maskCardNumber(last4: string): string {
  return `•••• ${last4}`
}

/** An opaque handle for the issued number. Safe to store and to log. */
export function cardReference(random: () => number = Math.random): string {
  let suffix = ""
  while (suffix.length < 12) suffix += Math.floor(random() * 10)
  return `crd_ref_${suffix}`
}

const TRANSITIONS: Record<CardStatus, readonly CardStatus[]> = {
  active: ["frozen", "cancelled"],
  frozen: ["active", "cancelled"],
  cancelled: [],
}

/** Guarded on the server, not only in the UI. `cancelled` is terminal. */
export function canTransition(from: CardStatus, to: CardStatus): boolean {
  return TRANSITIONS[from].includes(to)
}

export interface IssueCardInput {
  nickname: string
  merchantId: string
  spendLimit: number
  currency: Currency
  category: MerchantCategory | null
}

/**
 * Everything the client sends, checked against an allowlist before it reaches
 * the store. Returns the first problem in a message safe to show a user.
 */
export function validateIssueInput(
  body: unknown,
  merchantCurrency: (id: string) => Currency | null,
): { ok: true; value: IssueCardInput } | { ok: false; message: string } {
  const input = (body ?? {}) as Record<string, unknown>

  const nickname = typeof input.nickname === "string" ? input.nickname.trim() : ""
  if (!nickname) return { ok: false, message: "Give the card a nickname." }
  if (nickname.length > 60) {
    return { ok: false, message: "Nickname must be 60 characters or fewer." }
  }

  const merchantId = typeof input.merchantId === "string" ? input.merchantId : ""
  const settlesIn = merchantId ? merchantCurrency(merchantId) : null
  if (!merchantId || !settlesIn) {
    return { ok: false, message: "Choose a merchant for this card." }
  }

  const spendLimit = input.spendLimit
  if (typeof spendLimit !== "number" || !Number.isInteger(spendLimit)) {
    return {
      ok: false,
      message: "Spend limit must be a whole number of minor units.",
    }
  }
  if (spendLimit <= 0) {
    return { ok: false, message: "Spend limit must be greater than zero." }
  }
  if (spendLimit > MAX_SPEND_LIMIT) {
    return {
      ok: false,
      message: "Spend limit cannot exceed 5,000,000 minor units.",
    }
  }

  const currency = input.currency as Currency
  if (!CARD_CURRENCIES.includes(currency)) {
    return { ok: false, message: "Currency must be USD, EUR, or GBP." }
  }
  // A card settles in its merchant currency. The form defaults to it, but a
  // client can send anything, so the pairing is enforced here.
  if (currency !== settlesIn) {
    return {
      ok: false,
      message: `This merchant settles in ${settlesIn}, so the card must be ${settlesIn}.`,
    }
  }

  const rawCategory = input.category
  let category: MerchantCategory | null = null
  if (rawCategory !== null && rawCategory !== undefined && rawCategory !== "") {
    if (!MERCHANT_CATEGORIES.includes(rawCategory as MerchantCategory)) {
      return { ok: false, message: "That is not a category we can lock to." }
    }
    category = rawCategory as MerchantCategory
  }

  return {
    ok: true,
    value: { nickname, merchantId, spendLimit, currency, category },
  }
}

/** Fraction of the limit already spent, clamped to [0, 1]. */
export function spendRatio(card: Pick<Card, "spend" | "spendLimit">): number {
  if (card.spendLimit <= 0) return 0
  return Math.min(1, Math.max(0, card.spend / card.spendLimit))
}
