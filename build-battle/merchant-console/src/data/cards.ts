import {
  CARD_CATEGORIES,
  CARD_STATUSES,
  canTransition,
  generateCardNumber,
  MAX_SPEND_LIMIT,
} from "@/lib/cards"
import { CURRENCIES } from "@/lib/money"
import { merchantById } from "./merchants"
import { store } from "./store"
import { Card, CardCategory, CardStatus, Currency } from "./types"

/**
 * Virtual cards: lookups, the validated write path, and the status
 * transition guard. Route handlers call these rather than touching the
 * store themselves. Nothing here ever stores or returns a full card number.
 */

export interface IssueCardInput {
  nickname: string
  merchantId: string
  category: CardCategory
  /** Integer minor units. */
  spendLimit: number
  currency: Currency
}

export type Validation<T> =
  { ok: true; value: T } | { ok: false; message: string }

const NICKNAME_MAX = 40

/**
 * Anything from the client is checked against an allowlist before it reaches
 * the store. Rejects early; the first failure is the message.
 */
export function parseIssueCardInput(body: unknown): Validation<IssueCardInput> {
  if (typeof body !== "object" || body === null) {
    return { ok: false, message: "Request body must be a JSON object." }
  }
  const input = body as Record<string, unknown>

  const nickname =
    typeof input.nickname === "string" ? input.nickname.trim() : ""
  if (!nickname) return { ok: false, message: "Nickname is required." }
  if (nickname.length > NICKNAME_MAX) {
    return {
      ok: false,
      message: `Nickname must be ${NICKNAME_MAX} characters or fewer.`,
    }
  }

  const merchantId =
    typeof input.merchantId === "string" ? input.merchantId : ""
  if (!merchantId || !merchantById(merchantId)) {
    return { ok: false, message: "Choose a merchant." }
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

  const currency = input.currency
  if (!CURRENCIES.includes(currency as Currency)) {
    return { ok: false, message: "Currency must be USD, EUR, or GBP." }
  }

  const category = input.category ?? "general"
  if (!CARD_CATEGORIES.includes(category as CardCategory)) {
    return { ok: false, message: "Choose a merchant category from the list." }
  }

  return {
    ok: true,
    value: {
      nickname,
      merchantId,
      category: category as CardCategory,
      spendLimit,
      currency: currency as Currency,
    },
  }
}

export function parseCardStatus(body: unknown): Validation<CardStatus> {
  const status =
    typeof body === "object" && body !== null
      ? (body as Record<string, unknown>).status
      : undefined
  if (!CARD_STATUSES.includes(status as CardStatus)) {
    return {
      ok: false,
      message: "Status must be active, frozen, or cancelled.",
    }
  }
  return { ok: true, value: status as CardStatus }
}

/** Newest first, the way ops looks for the card they just issued. */
export function listCards(): Card[] {
  return [...store.cards].sort((a, b) => b.createdAt.localeCompare(a.createdAt))
}

export function cardById(id: string): Card | null {
  return store.cards.find((c) => c.id === id) ?? null
}

const pad = (n: number, width = 6) => String(n).padStart(width, "0")

/**
 * Creates the card and returns the full number alongside it, once. The
 * record keeps the last four and an opaque reference; the number is not
 * stored anywhere and cannot be read back.
 */
export function issueCard(input: IssueCardInput): {
  card: Card
  number: string
} {
  const number = generateCardNumber()
  const createdAt = new Date().toISOString()
  const card: Card = {
    id: `card_${pad(store.cards.length + 1)}`,
    nickname: input.nickname,
    merchantId: input.merchantId,
    category: input.category,
    spendLimit: input.spendLimit,
    spent: 0,
    currency: input.currency,
    status: "active",
    last4: number.slice(-4),
    reference: `ref_${crypto.randomUUID().replace(/-/g, "").slice(0, 20)}`,
    createdAt,
    history: [{ status: "active", at: createdAt }],
  }
  store.cards.push(card)
  return { card, number }
}

export type StatusChange =
  { ok: true; card: Card } | { ok: false; status: 404 | 409; message: string }

/** Guards the state machine on the server. The UI only mirrors it. */
export function changeCardStatus(id: string, to: CardStatus): StatusChange {
  const card = cardById(id)
  if (!card) return { ok: false, status: 404, message: "Card not found." }
  if (!canTransition(card.status, to)) {
    return {
      ok: false,
      status: 409,
      message:
        card.status === "cancelled"
          ? "A cancelled card cannot be changed."
          : `A ${card.status} card cannot become ${to}.`,
    }
  }
  card.status = to
  card.history.push({ status: to, at: new Date().toISOString() })
  return { ok: true, card }
}
