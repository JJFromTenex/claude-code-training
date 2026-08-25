import { Card, CardCategory, CardStatus, Currency, Payment } from "@/data/types"

/**
 * Card primitives: number generation, masking, and the status state machine.
 *
 * Everything here is pure. Generation happens on the server only — a card
 * number produced in the browser is a bug — so nothing in this file may be
 * imported into a client component.
 */

/** The test BIN. Every generated number starts with it, so none can resemble a real PAN. */
export const TEST_BIN = "4242"

const CARD_NUMBER_LENGTH = 16

export const CARD_CATEGORIES = [
  "advertising",
  "software",
  "travel",
  "contractors",
  "utilities",
] as const

export const CARD_STATUSES = ["active", "frozen", "cancelled"] as const

/** Ceiling from the ticket: 5,000,000 minor units. */
export const MAX_SPEND_LIMIT = 5_000_000

const CURRENCIES: readonly Currency[] = ["USD", "EUR", "GBP"]

/**
 * The transition table. `cancelled` has no outgoing edges, which is what makes
 * it terminal — there is no code path that needs to remember the rule.
 */
const TRANSITIONS: Record<CardStatus, readonly CardStatus[]> = {
  active: ["frozen", "cancelled"],
  frozen: ["active", "cancelled"],
  cancelled: [],
}

export function canTransition(from: CardStatus, to: CardStatus): boolean {
  return TRANSITIONS[from].includes(to)
}

export function allowedTransitions(from: CardStatus): readonly CardStatus[] {
  return TRANSITIONS[from]
}

/** Luhn check over a complete number, check digit included. */
export function isLuhnValid(digits: string): boolean {
  if (!/^\d+$/.test(digits)) return false

  let total = 0
  let double = false
  for (let i = digits.length - 1; i >= 0; i--) {
    let value = Number(digits[i])
    if (double) {
      value *= 2
      if (value > 9) value -= 9
    }
    total += value
    double = !double
  }
  return total % 10 === 0
}

/** The digit that completes a Luhn-valid number for the given prefix. */
export function luhnCheckDigit(partial: string): string {
  let total = 0
  let double = true
  for (let i = partial.length - 1; i >= 0; i--) {
    let value = Number(partial[i])
    if (double) {
      value *= 2
      if (value > 9) value -= 9
    }
    total += value
    double = !double
  }
  return String((10 - (total % 10)) % 10)
}

/**
 * Generate a card number on the test BIN with a valid check digit.
 *
 * `endingIn` forces the last four digits, which the seed data uses to link a
 * card to payments that already exist. The check digit is determined by
 * everything before it, so the body is searched until it lands on the digit
 * the caller asked for. Issuance does not pass it.
 *
 * @param nextDigit - Source of randomness, returning a float in [0, 1)
 * @param endingIn - Optional four digits the number must end with
 */
export function generateCardNumber(
  nextDigit: () => number,
  endingIn?: string,
): string {
  const bodyLength = CARD_NUMBER_LENGTH - TEST_BIN.length - 1

  if (endingIn === undefined) {
    let body = ""
    for (let i = 0; i < bodyLength; i++) {
      body += String(Math.floor(nextDigit() * 10))
    }
    const partial = TEST_BIN + body
    return partial + luhnCheckDigit(partial)
  }

  if (!/^\d{4}$/.test(endingIn)) {
    throw new Error("endingIn must be exactly four digits")
  }

  const fixedPrefix = endingIn.slice(0, 3)
  const requiredCheckDigit = endingIn.slice(3)
  const freeLength = bodyLength - fixedPrefix.length

  let free = ""
  for (let i = 0; i < freeLength - 1; i++) {
    free += String(Math.floor(nextDigit() * 10))
  }

  // Solve for the last free digit rather than searching for it. Luhn maps a
  // digit to its contribution one-to-one in both the doubled and undoubled
  // position, so stepping this one through 0-9 steps the check digit through
  // every value: exactly one candidate lands on the one the caller asked for.
  // Re-rolling the whole body instead would fail roughly a third of the time.
  for (let candidate = 0; candidate < 10; candidate++) {
    const partial = TEST_BIN + free + String(candidate) + fixedPrefix
    if (luhnCheckDigit(partial) === requiredCheckDigit) {
      return partial + requiredCheckDigit
    }
  }

  /* c8 ignore next */
  throw new Error(`could not generate a number ending in ${endingIn}`)
}

/** The only representation of a card number allowed outside the creation response. */
export function maskCardNumber(last4: string): string {
  return `•••• ${last4}`
}

export function lastFour(cardNumber: string): string {
  return cardNumber.slice(-4)
}

/**
 * Spend on a card, derived rather than stored.
 *
 * Nothing in the store links a payment to a card directly, so the link is
 * merchant + currency + last four, over captured payments only. A freshly
 * issued card matches nothing and is honestly zero; it is never a number
 * invented at issue time.
 *
 * @returns Integer minor units, in the card's own currency
 */
export function spendForCard(
  payments: readonly Payment[],
  card: Pick<Card, "merchantId" | "currency" | "last4">,
): number {
  return payments
    .filter(
      (payment) =>
        payment.status === "captured" &&
        payment.merchantId === card.merchantId &&
        payment.currency === card.currency &&
        payment.last4 === card.last4,
    )
    .reduce((total, payment) => total + payment.amount, 0)
}

export interface IssueCardInput {
  nickname: string
  merchantId: string
  spendLimit: number
  currency: Currency
  categoryLock: CardCategory | null
}

export interface ValidationFailure {
  field: string
  message: string
}

/**
 * Validate an issue request. Called by the route handler, never by the form
 * alone — the client's own checks are a convenience.
 *
 * @param input - Raw, untrusted values from the request body
 * @param context - The merchant ids that exist, and the currency each one settles in
 * @returns The validated input, or the reasons it was refused
 */
export function validateIssueInput(
  input: Record<string, unknown>,
  context: { merchantCurrency: (id: string) => Currency | undefined },
): { ok: true; value: IssueCardInput } | { ok: false; errors: ValidationFailure[] } {
  const errors: ValidationFailure[] = []

  const nickname = typeof input.nickname === "string" ? input.nickname.trim() : ""
  if (nickname.length === 0) {
    errors.push({ field: "nickname", message: "Give the card a nickname." })
  } else if (nickname.length > 60) {
    errors.push({ field: "nickname", message: "Nickname is limited to 60 characters." })
  }

  const merchantId = typeof input.merchantId === "string" ? input.merchantId : ""
  const merchantCurrency = context.merchantCurrency(merchantId)
  if (merchantCurrency === undefined) {
    errors.push({ field: "merchantId", message: "Choose a merchant." })
  }

  const spendLimit = input.spendLimit
  if (typeof spendLimit !== "number" || !Number.isInteger(spendLimit)) {
    errors.push({
      field: "spendLimit",
      message: "Spend limit must be a whole number of minor units.",
    })
  } else if (spendLimit <= 0) {
    errors.push({ field: "spendLimit", message: "Spend limit must be above zero." })
  } else if (spendLimit > MAX_SPEND_LIMIT) {
    errors.push({
      field: "spendLimit",
      message: "Spend limit cannot exceed 5,000,000 minor units.",
    })
  }

  const currency = input.currency
  const validCurrency = CURRENCIES.find((candidate) => candidate === currency)
  if (validCurrency === undefined) {
    errors.push({ field: "currency", message: "Currency must be USD, EUR, or GBP." })
  } else if (merchantCurrency !== undefined && validCurrency !== merchantCurrency) {
    // Nobody asked for this, but a card that settles in a currency its merchant
    // does not use is a support ticket waiting to happen.
    errors.push({
      field: "currency",
      message: `This merchant settles in ${merchantCurrency}.`,
    })
  }

  const rawCategory = input.categoryLock
  let categoryLock: CardCategory | null = null
  if (rawCategory !== null && rawCategory !== undefined && rawCategory !== "") {
    const match = CARD_CATEGORIES.find((candidate) => candidate === rawCategory)
    if (match === undefined) {
      errors.push({ field: "categoryLock", message: "Unknown category." })
    } else {
      categoryLock = match
    }
  }

  if (errors.length > 0 || validCurrency === undefined) {
    return { ok: false, errors }
  }

  return {
    ok: true,
    value: {
      nickname,
      merchantId,
      spendLimit: typeof spendLimit === "number" ? spendLimit : 0,
      currency: validCurrency,
      categoryLock,
    },
  }
}
