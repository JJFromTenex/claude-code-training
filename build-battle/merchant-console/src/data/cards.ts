import {
  canTransition,
  generateCardNumber,
  lastFour,
} from "@/lib/cards"
import { merchantById } from "./merchants"
import { store } from "./store"
import { Card, CardCategory, CardStatus, Currency } from "./types"

/**
 * Every card read and write goes through this module. It owns validation as
 * well, so the route handlers stay thin and the boundaries stay testable
 * without standing up HTTP.
 */

/** The largest limit ops may set, in minor units: 5,000,000. */
export const MAX_SPEND_LIMIT = 5_000_000

export const CURRENCIES: readonly Currency[] = ["USD", "EUR", "GBP"]

export const CARD_CATEGORIES: readonly CardCategory[] = [
  "advertising",
  "software",
  "travel",
  "contractors",
  "supplies",
]

const NICKNAME_MAX_LENGTH = 60

/**
 * Reject-and-return, rather than throwing. The status travels with the
 * failure so the route handler does not have to guess at one.
 */
export type Result<T> =
  | { ok: true; value: T }
  | { ok: false; status: number; error: string; field?: string }

const fail = (status: number, error: string, field?: string): Result<never> => ({
  ok: false,
  status,
  error,
  field,
})

export interface IssueCardInput {
  nickname: string
  merchantId: string
  /** Integer minor units. A limit that arrives as "250.00" is client input that was never converted. */
  spendLimit: number
  currency: Currency
  category: CardCategory | null
}

/**
 * Checks anything that arrived from a client against an allowlist before it
 * reaches the store. The console's own form checks the same things, but those
 * are there to save a round trip, never to enforce anything.
 */
export function validateIssueInput(body: unknown): Result<IssueCardInput> {
  if (typeof body !== "object" || body === null) {
    return fail(400, "Expected a JSON object.")
  }
  const input = body as Record<string, unknown>

  const nickname =
    typeof input.nickname === "string" ? input.nickname.trim() : ""
  if (nickname.length === 0) {
    return fail(400, "Give the card a nickname.", "nickname")
  }
  if (nickname.length > NICKNAME_MAX_LENGTH) {
    return fail(
      400,
      `A nickname is at most ${NICKNAME_MAX_LENGTH} characters.`,
      "nickname",
    )
  }

  const merchantId =
    typeof input.merchantId === "string" ? input.merchantId : ""
  if (merchantId.length === 0) {
    return fail(400, "Choose a merchant.", "merchantId")
  }
  if (!merchantById(merchantId)) {
    return fail(400, "That merchant does not exist.", "merchantId")
  }

  const spendLimit = input.spendLimit
  if (typeof spendLimit !== "number" || !Number.isInteger(spendLimit)) {
    return fail(
      400,
      "A spend limit is a whole number of minor units — $250.00 is 25000.",
      "spendLimit",
    )
  }
  if (spendLimit <= 0) {
    return fail(400, "A spend limit must be greater than zero.", "spendLimit")
  }
  if (spendLimit > MAX_SPEND_LIMIT) {
    return fail(
      400,
      `A spend limit cannot exceed ${MAX_SPEND_LIMIT} minor units.`,
      "spendLimit",
    )
  }

  const currency = input.currency
  if (!CURRENCIES.includes(currency as Currency)) {
    return fail(400, `Currency must be one of ${CURRENCIES.join(", ")}.`, "currency")
  }

  const raw = input.category
  const category =
    raw === undefined || raw === null || raw === "" ? null : (raw as CardCategory)
  if (category !== null && !CARD_CATEGORIES.includes(category)) {
    return fail(400, "That is not a category a card can be locked to.", "category")
  }

  return {
    ok: true,
    value: {
      nickname,
      merchantId,
      spendLimit,
      currency: currency as Currency,
      category,
    },
  }
}

/**
 * Issues a card and hands back the full number exactly once.
 *
 * The number lives in one local variable long enough to take its last four.
 * It is never written to the record, so no later read can surface it.
 */
export function issueCard(
  input: IssueCardInput,
  now: Date = new Date(),
): { card: Card; cardNumber: string } {
  const cardNumber = generateCardNumber()
  const createdAt = now.toISOString()
  const sequence = store.cards.length + 1

  const card: Card = {
    id: `card_${String(sequence).padStart(6, "0")}`,
    merchantId: input.merchantId,
    nickname: input.nickname,
    last4: lastFour(cardNumber),
    reference: `cref_${String(sequence).padStart(6, "0")}`,
    spendLimit: input.spendLimit,
    spent: 0,
    currency: input.currency,
    status: "active",
    category: input.category,
    createdAt,
    history: [{ at: createdAt, status: "active", note: "Card issued" }],
  }

  store.cards.push(card)
  return { card, cardNumber }
}

/** Newest first, the way every other list in the console reads. */
export function listCards(): Card[] {
  return [...store.cards].sort((a, b) => b.createdAt.localeCompare(a.createdAt))
}

export function cardById(id: string): Card | null {
  return store.cards.find((card) => card.id === id) ?? null
}

const NOTES: Record<CardStatus, string> = {
  active: "Unfrozen",
  frozen: "Frozen",
  cancelled: "Cancelled",
}

/**
 * The only way a card's status changes. The UI hides the buttons it should
 * not offer; this is what actually refuses them.
 */
export function setCardStatus(
  id: string,
  next: unknown,
  now: Date = new Date(),
): Result<Card> {
  const card = cardById(id)
  if (!card) return fail(404, "No card with that id.")

  if (!isCardStatus(next)) {
    return fail(400, "That is not a card status.", "status")
  }
  if (!canTransition(card.status, next)) {
    return fail(
      409,
      card.status === "cancelled"
        ? "A cancelled card is cancelled for good."
        : `A card that is already ${card.status} cannot become ${next}.`,
      "status",
    )
  }

  card.status = next
  card.history.push({
    at: now.toISOString(),
    status: next,
    note: NOTES[next],
  })
  return { ok: true, value: card }
}

function isCardStatus(value: unknown): value is CardStatus {
  return value === "active" || value === "frozen" || value === "cancelled"
}
