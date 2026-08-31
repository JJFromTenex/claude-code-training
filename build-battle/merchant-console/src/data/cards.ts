import {
  CARD_CATEGORIES,
  canTransition,
  generateCardNumber,
  lastFour,
} from "@/lib/cards"
import { formatMoney, parseAmountToMinorUnits } from "@/lib/money"
import { merchantById } from "./merchants"
import { store } from "./store"
import { Card, CardCategory, CardStatus, Currency } from "./types"

/**
 * The one place that reads and writes `store.cards`. Route handlers call these
 * rather than touching the store, and validation lives here so every entry
 * point gets the same allowlist.
 */

export const CARD_CURRENCIES: readonly Currency[] = ["USD", "EUR", "GBP"]

/** Minor units. Inclusive: the ticket rejects a limit *above* this. */
export const MAX_SPEND_LIMIT = 5_000_000

export const MAX_NICKNAME_LENGTH = 60

export function listCards(): Card[] {
  return [...store.cards].sort((a, b) => b.createdAt.localeCompare(a.createdAt))
}

export function cardById(id: string): Card | null {
  return store.cards.find((card) => card.id === id) ?? null
}

export interface CardInput {
  nickname: string
  merchantId: string
  /** Integer minor units. */
  spendLimit: number
  currency: Currency
  categoryLock: CardCategory
}

export type ParsedCardInput =
  | { ok: true; value: CardInput }
  | { ok: false; error: string }

/**
 * Validate an issue request. Everything here arrives from the client, so
 * nothing is trusted: the merchant must exist, the currency must be on the
 * allowlist, and the limit is parsed from user input rather than accepted as
 * a number, so `250.00` and `250` both land on the same minor units.
 */
export function parseCardInput(body: unknown): ParsedCardInput {
  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    return { ok: false, error: "Expected a JSON object." }
  }
  const raw = body as Record<string, unknown>

  const nickname =
    typeof raw.nickname === "string" ? raw.nickname.trim() : ""
  if (nickname.length === 0) {
    return { ok: false, error: "Give the card a nickname." }
  }
  if (nickname.length > MAX_NICKNAME_LENGTH) {
    return {
      ok: false,
      error: `Nickname must be ${MAX_NICKNAME_LENGTH} characters or fewer.`,
    }
  }

  if (typeof raw.merchantId !== "string" || !merchantById(raw.merchantId)) {
    return { ok: false, error: "Choose a merchant that exists." }
  }

  if (
    typeof raw.currency !== "string" ||
    !CARD_CURRENCIES.includes(raw.currency as Currency)
  ) {
    return {
      ok: false,
      error: `Currency must be one of ${CARD_CURRENCIES.join(", ")}.`,
    }
  }
  const currency = raw.currency as Currency

  if (typeof raw.spendLimit !== "string") {
    return {
      ok: false,
      error: 'Spend limit must be a string in major units, for example "250.00".',
    }
  }
  const spendLimit = parseAmountToMinorUnits(raw.spendLimit)
  if (spendLimit === null) {
    return {
      ok: false,
      error: "Spend limit must be an amount, for example 250 or 250.00.",
    }
  }
  if (spendLimit <= 0) {
    return { ok: false, error: "Spend limit must be greater than zero." }
  }
  if (spendLimit > MAX_SPEND_LIMIT) {
    return {
      ok: false,
      error: `Spend limit must be ${formatMoney(MAX_SPEND_LIMIT, currency)} or less.`,
    }
  }

  // Absent means unrestricted. A name that is not on the list is a rejection,
  // not a silent fallback to `any`.
  const categoryLock = raw.categoryLock === undefined ? "any" : raw.categoryLock
  if (
    typeof categoryLock !== "string" ||
    !CARD_CATEGORIES.includes(categoryLock as CardCategory)
  ) {
    return {
      ok: false,
      error: `Category must be one of ${CARD_CATEGORIES.join(", ")}.`,
    }
  }

  return {
    ok: true,
    value: {
      nickname,
      merchantId: raw.merchantId,
      spendLimit,
      currency,
      categoryLock: categoryLock as CardCategory,
    },
  }
}

/**
 * The next sequence number, taken from the highest id in the store rather than
 * its length, so the id and the number reference come from one value and cannot
 * drift apart.
 */
function nextSequence(): string {
  const highest = store.cards.reduce((max, card) => {
    const n = Number(card.id.replace("card_", ""))
    return Number.isFinite(n) && n > max ? n : max
  }, 0)
  return String(highest + 1).padStart(6, "0")
}

/**
 * Issue a card. The full number is generated here, returned to the caller
 * once, and never stored — only its last four goes on the record.
 */
export function issueCard(
  input: CardInput,
  now = new Date(),
): { card: Card; number: string } {
  const number = generateCardNumber()
  const sequence = nextSequence()
  const card: Card = {
    id: `card_${sequence}`,
    nickname: input.nickname,
    merchantId: input.merchantId,
    last4: lastFour(number),
    numberRef: `cn_${sequence}`,
    spendLimit: input.spendLimit,
    spent: 0,
    currency: input.currency,
    status: "active",
    categoryLock: input.categoryLock,
    createdAt: now.toISOString(),
  }
  store.cards.push(card)
  return { card, number }
}

export type StatusChange =
  | { ok: true; card: Card }
  | { ok: false; status: 400 | 404; error: string }

/** Guarded on the server, not only in the UI. `cancelled` is terminal. */
export function setCardStatus(id: string, next: CardStatus): StatusChange {
  const card = cardById(id)
  if (!card) return { ok: false, status: 404, error: "No card with that id." }
  if (card.status === next) return { ok: true, card }
  if (!canTransition(card.status, next)) {
    return {
      ok: false,
      status: 400,
      error: `A ${card.status} card cannot become ${next}.`,
    }
  }
  card.status = next
  return { ok: true, card }
}
