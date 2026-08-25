import { merchantById } from "./merchants"
import { store } from "./store"
import { Card, CardStatus, Currency, MerchantCategory } from "./types"

// Server-side idempotency: an Idempotency-Key maps to the card it created, so a
// retried or double-fired issue request returns the same card instead of a
// second one. Lives for the process, like the store itself.
const issuedByKey = new Map<string, string>()

/**
 * The one place cards are created, read, and transitioned. Route handlers call
 * these; they never touch `store.cards` directly. A second lookup or write path
 * is a defect (one query builder, same as `queries.ts`).
 *
 * Card numbers are generated here, server-side, on the 4242 test BIN with a
 * valid Luhn check digit. The full number is returned exactly once, by
 * `issueCard`; only the last four is ever stored.
 */

const TEST_BIN = "4242"
const CARD_LENGTH = 16

export const CARD_CURRENCIES: readonly Currency[] = ["USD", "EUR", "GBP"]
export const CARD_CATEGORIES: readonly MerchantCategory[] = [
  "advertising",
  "software",
  "travel",
  "utilities",
  "office_supplies",
]

/** Upper bound on a spend limit, in integer minor units. */
export const MAX_SPEND_LIMIT = 5_000_000

// --- Luhn + number generation -------------------------------------------------

/** Sum a full number under the Luhn algorithm (doubling every second digit from the right). */
function luhnSum(digits: string): number {
  let sum = 0
  for (let i = 0; i < digits.length; i++) {
    let d = Number(digits[digits.length - 1 - i])
    if (i % 2 === 1) {
      d *= 2
      if (d > 9) d -= 9
    }
    sum += d
  }
  return sum
}

/** The check digit that makes `partial` (everything but the check digit) Luhn-valid. */
export function luhnCheckDigit(partial: string): string {
  let sum = 0
  for (let i = 0; i < partial.length; i++) {
    let d = Number(partial[partial.length - 1 - i])
    // In the full number the partial's digits shift left by one (the check
    // digit takes position 0), so double when i is even.
    if (i % 2 === 0) {
      d *= 2
      if (d > 9) d -= 9
    }
    sum += d
  }
  return String((10 - (sum % 10)) % 10)
}

export function isValidLuhn(number: string): boolean {
  return /^\d+$/.test(number) && luhnSum(number) % 10 === 0
}

/** A 16-digit number on the 4242 test BIN with a valid Luhn check digit. */
export function generateCardNumber(rand: () => number = Math.random): string {
  let body = TEST_BIN
  while (body.length < CARD_LENGTH - 1) {
    body += Math.floor(rand() * 10)
  }
  return body + luhnCheckDigit(body)
}

// --- Reads --------------------------------------------------------------------

export function cardById(id: string): Card | undefined {
  return store.cards.find((c) => c.id === id)
}

/** Every issued card, newest first. */
export function allCards(): Card[] {
  return [...store.cards].sort((a, b) => b.createdAt.localeCompare(a.createdAt))
}

function nextCardId(): string {
  // Cards are only ever appended (cancelled stays in the array), so the length
  // is a monotonic sequence.
  return `card_${String(store.cards.length + 1).padStart(6, "0")}`
}

// --- Issue --------------------------------------------------------------------

export interface IssueCardInput {
  nickname: string
  merchantId: string
  /** Integer minor units, already parsed at the boundary. */
  spendLimit: number
  currency: Currency
  category?: MerchantCategory | null
  /** Optional client-supplied key that makes a repeated issue idempotent. */
  idempotencyKey?: string
}

export type IssueResult =
  | { ok: true; card: Card; number: string | null; duplicate: boolean }
  | { ok: false; message: string }

export function issueCard(input: IssueCardInput): IssueResult {
  const nickname = input.nickname?.trim()
  if (!nickname) return { ok: false, message: "Nickname is required." }

  const merchant = merchantById(input.merchantId)
  if (!merchant) return { ok: false, message: "Unknown merchant." }
  if (!Number.isInteger(input.spendLimit) || input.spendLimit <= 0)
    return { ok: false, message: "Spend limit must be a positive amount." }
  if (input.spendLimit > MAX_SPEND_LIMIT)
    return { ok: false, message: "Spend limit exceeds the maximum of 5,000,000." }
  if (!CARD_CURRENCIES.includes(input.currency))
    return { ok: false, message: "Currency must be USD, EUR, or GBP." }
  // A card settles in its merchant's currency; a mismatch is a data-integrity bug.
  if (input.currency !== merchant.currency)
    return {
      ok: false,
      message: `${merchant.name} settles in ${merchant.currency}; issue the card in ${merchant.currency}.`,
    }

  const category = input.category ?? null
  if (category !== null && !CARD_CATEGORIES.includes(category))
    return { ok: false, message: "Unknown category." }

  // Idempotent replay: a key we have already fulfilled returns its card, and
  // never a second reveal of the number (reveal-once holds).
  if (input.idempotencyKey) {
    const priorId = issuedByKey.get(input.idempotencyKey)
    if (priorId) {
      const prior = cardById(priorId)
      if (prior) return { ok: true, card: prior, number: null, duplicate: true }
    }
  }

  const number = generateCardNumber()
  const now = new Date().toISOString()
  const card: Card = {
    id: nextCardId(),
    nickname,
    merchantId: input.merchantId,
    spendLimit: input.spendLimit,
    spend: 0,
    currency: input.currency,
    status: "active",
    last4: number.slice(-4),
    category,
    createdAt: now,
    history: [{ at: now, from: null, to: "active" }],
  }
  store.cards.push(card)
  if (input.idempotencyKey) issuedByKey.set(input.idempotencyKey, card.id)
  return { ok: true, card, number, duplicate: false }
}

// --- Status transitions -------------------------------------------------------

const TRANSITIONS: Record<CardStatus, readonly CardStatus[]> = {
  active: ["frozen", "cancelled"],
  frozen: ["active", "cancelled"],
  cancelled: [],
}

export function canTransition(from: CardStatus, to: CardStatus): boolean {
  return TRANSITIONS[from].includes(to)
}

export type StatusResult =
  | { ok: true; card: Card }
  | { ok: false; message: string; notFound?: boolean }

export function setCardStatus(id: string, to: CardStatus): StatusResult {
  const card = cardById(id)
  if (!card) return { ok: false, message: "Card not found.", notFound: true }
  if (!canTransition(card.status, to))
    return {
      ok: false,
      message: `A ${card.status} card cannot become ${to}.`,
    }
  card.history.push({ at: new Date().toISOString(), from: card.status, to })
  card.status = to
  return { ok: true, card }
}
