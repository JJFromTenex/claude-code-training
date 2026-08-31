import { generateCardNumber } from "@/lib/cards"
import { formatMoney, parseAmountToMinorUnits } from "@/lib/money"
import { merchantById } from "./merchants"
import { paginate } from "./queries"
import { store } from "./store"
import {
  CardCategory,
  CardStatus,
  Currency,
  VirtualCard,
} from "./types"

/** The largest limit ops may set, in minor units. Above this is rejected. */
export const MAX_CARD_LIMIT = 5_000_000

export const CARD_STATUSES: readonly CardStatus[] = [
  "active",
  "frozen",
  "cancelled",
]

export const CARD_CATEGORIES: readonly CardCategory[] = [
  "advertising",
  "software",
  "travel",
  "contractors",
  "utilities",
]

const CURRENCIES: readonly Currency[] = ["USD", "EUR", "GBP"]

/**
 * active and frozen swap freely; either can be cancelled; cancelled is
 * terminal. Keyed by CardStatus so a new status breaks the build rather
 * than silently permitting nothing.
 */
const TRANSITIONS: Record<CardStatus, readonly CardStatus[]> = {
  active: ["frozen", "cancelled"],
  frozen: ["active", "cancelled"],
  cancelled: [],
}

export function canTransition(from: CardStatus, to: CardStatus): boolean {
  return TRANSITIONS[from].includes(to)
}

/** A status code that means what it says, and a message safe to show a user. */
export interface CardError {
  status: number
  message: string
}

export interface NewCardInput {
  nickname: string
  merchantId: string
  limit: number
  currency: Currency
  category: CardCategory
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null
}

/**
 * Anything from the client is checked against an allowlist before it reaches
 * the store. Route handlers call this rather than reading the body
 * themselves. Rejects early and returns; first failure wins.
 */
export function parseCardInput(
  body: unknown,
): { input: NewCardInput } | { error: CardError } {
  if (!isRecord(body)) {
    return { error: { status: 400, message: "Send a JSON body." } }
  }

  const nickname =
    typeof body.nickname === "string" ? body.nickname.trim() : ""
  if (!nickname) {
    return { error: { status: 400, message: "Give the card a nickname." } }
  }
  if (nickname.length > 60) {
    return {
      error: {
        status: 400,
        message: "Nickname must be 60 characters or fewer.",
      },
    }
  }

  if (typeof body.merchantId !== "string" || !body.merchantId) {
    return { error: { status: 400, message: "Choose a merchant." } }
  }
  const merchant = merchantById(body.merchantId)
  if (!merchant) {
    return { error: { status: 400, message: "That merchant does not exist." } }
  }

  if (!CURRENCIES.includes(body.currency as Currency)) {
    return {
      error: { status: 400, message: "Currency must be USD, EUR, or GBP." },
    }
  }
  const currency = body.currency as Currency

  if (!CARD_CATEGORIES.includes(body.category as CardCategory)) {
    return {
      error: { status: 400, message: "Choose a category for the card." },
    }
  }
  const category = body.category as CardCategory

  // The limit arrives as typed text and is converted here, once, on the
  // server. A client that multiplied by 100 itself is rejected.
  if (typeof body.limit !== "string") {
    return {
      error: { status: 400, message: "Enter a spend limit like 250.00." },
    }
  }
  const limit = parseAmountToMinorUnits(body.limit)
  if (limit === null) {
    return {
      error: { status: 400, message: "Enter a spend limit like 250.00." },
    }
  }
  if (limit <= 0) {
    return {
      error: { status: 400, message: "Spend limit must be more than zero." },
    }
  }
  if (limit > MAX_CARD_LIMIT) {
    return {
      error: {
        status: 400,
        message: `Spend limit cannot exceed ${formatMoney(
          MAX_CARD_LIMIT,
          currency,
        )}.`,
      },
    }
  }

  return {
    input: { nickname, merchantId: merchant.id, limit, currency, category },
  }
}

function pad(value: number, width: number): string {
  return String(value).padStart(width, "0")
}

function nextCardId(): string {
  return `vcard_${pad(store.cards.length + 1, 4)}`
}

/**
 * Issues a card and hands back the number separately.
 *
 * The number is a local value here and never lands on the record, so the
 * only place it can reach a client is the response to this one request.
 */
export function issueCard(input: NewCardInput): {
  card: VirtualCard
  number: string
} {
  const number = generateCardNumber()
  const createdAt = new Date().toISOString()

  const card: VirtualCard = {
    id: nextCardId(),
    merchantId: input.merchantId,
    nickname: input.nickname,
    last4: number.slice(-4),
    reference: `vcref_${Math.floor(Math.random() * 0xffffffff)
      .toString(16)
      .padStart(8, "0")}`,
    limit: input.limit,
    spent: 0,
    currency: input.currency,
    category: input.category,
    status: "active",
    createdAt,
    history: [{ at: createdAt, from: null, to: "active", actor: "console" }],
  }

  store.cards.push(card)
  return { card, number }
}

export function cardById(id: string): VirtualCard | null {
  return store.cards.find((card) => card.id === id) ?? null
}

/** Newest first. Reuses the shared paginator rather than slicing by hand. */
export function listCards(page = 1) {
  const sorted = [...store.cards].sort((a, b) =>
    b.createdAt.localeCompare(a.createdAt),
  )
  return paginate(sorted, page)
}

/**
 * The only path that changes a card's status. Guarded here rather than in
 * the UI, so a crafted request cannot revive a cancelled card.
 */
export function transitionCard(
  id: string,
  to: unknown,
): { card: VirtualCard } | { error: CardError } {
  const card = cardById(id)
  if (!card) {
    return { error: { status: 404, message: "Card not found." } }
  }
  if (!CARD_STATUSES.includes(to as CardStatus)) {
    return { error: { status: 400, message: "Unknown card status." } }
  }

  const next = to as CardStatus
  if (card.status === "cancelled") {
    return {
      error: { status: 409, message: "A cancelled card cannot be changed." },
    }
  }
  if (!canTransition(card.status, next)) {
    return {
      error: {
        status: 409,
        message: `A ${card.status} card cannot become ${next}.`,
      },
    }
  }

  card.history.push({
    at: new Date().toISOString(),
    from: card.status,
    to: next,
    actor: "console",
  })
  card.status = next
  return { card }
}
