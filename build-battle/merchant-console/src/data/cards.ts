import { generateCardNumber } from "@/lib/card-number"
import { merchantById } from "./merchants"
import { paginate } from "./queries"
import { store } from "./store"
import {
  Card,
  CardCategory,
  CardFilters,
  CardStatus,
  Currency,
} from "./types"

/**
 * Virtual cards: validation, the status state machine, and the card query
 * builder.
 *
 * Number generation and masking live in `src/lib/card-number.ts` — pure
 * helpers the seed generator also needs. Nothing here writes a full number to
 * a `Card`, because `Card` has no field that could hold one.
 */

/** Ceiling on a spend limit, in minor units: $50,000.00. */
export const MAX_SPEND_LIMIT = 5_000_000

export const CARD_CURRENCIES: readonly Currency[] = ["USD", "EUR", "GBP"]

export const CARD_CATEGORIES: readonly CardCategory[] = [
  "advertising",
  "software",
  "travel",
  "office",
  "other",
]

const NICKNAME_MAX_LENGTH = 60

/** `active ⇄ frozen`, either to `cancelled`, and `cancelled` is terminal. */
const TRANSITIONS: Record<CardStatus, readonly CardStatus[]> = {
  active: ["frozen", "cancelled"],
  frozen: ["active", "cancelled"],
  cancelled: [],
}

export function canTransition(from: CardStatus, to: CardStatus): boolean {
  return TRANSITIONS[from]?.includes(to) ?? false
}

export function isCardStatus(value: unknown): value is CardStatus {
  return value === "active" || value === "frozen" || value === "cancelled"
}

export interface IssueCardRequest {
  nickname: string
  merchantId: string
  /** Integer minor units. */
  spendLimit: number
  currency: Currency
  category: CardCategory | null
}

export type Validated<T> =
  | { ok: true; value: T }
  | { ok: false; message: string }

/**
 * Check a creation request against an allowlist before anything reaches the
 * store. The client is not trusted: its own checks are UX, never enforcement.
 * Rejects early rather than nesting, so no case goes missing.
 */
export function validateIssueRequest(body: unknown): Validated<IssueCardRequest> {
  if (typeof body !== "object" || body === null) {
    return { ok: false, message: "Expected a card to issue." }
  }

  const input = body as Record<string, unknown>

  const nickname =
    typeof input.nickname === "string" ? input.nickname.trim() : ""
  if (!nickname) {
    return { ok: false, message: "Give the card a nickname." }
  }
  if (nickname.length > NICKNAME_MAX_LENGTH) {
    return {
      ok: false,
      message: `Keep the nickname under ${NICKNAME_MAX_LENGTH} characters.`,
    }
  }

  const merchantId =
    typeof input.merchantId === "string" ? input.merchantId : ""
  if (!merchantId) {
    return { ok: false, message: "Choose a merchant." }
  }
  if (!merchantById(merchantId)) {
    return { ok: false, message: "That merchant does not exist." }
  }

  const spendLimit = input.spendLimit
  if (typeof spendLimit !== "number" || !Number.isInteger(spendLimit)) {
    return {
      ok: false,
      message: "The spend limit must be a whole number of minor units.",
    }
  }
  if (spendLimit <= 0) {
    return { ok: false, message: "The spend limit must be more than zero." }
  }
  if (spendLimit > MAX_SPEND_LIMIT) {
    return {
      ok: false,
      message: "The spend limit cannot exceed 5,000,000 minor units.",
    }
  }

  const currency = input.currency
  if (!CARD_CURRENCIES.includes(currency as Currency)) {
    return { ok: false, message: "Choose USD, EUR, or GBP." }
  }

  let category: CardCategory | null = null
  if (input.category != null && input.category !== "") {
    if (!CARD_CATEGORIES.includes(input.category as CardCategory)) {
      return { ok: false, message: "That category is not one we support." }
    }
    category = input.category as CardCategory
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

const CARD_STATUSES: readonly (CardStatus | "all")[] = [
  "all",
  "active",
  "frozen",
  "cancelled",
]

/**
 * Anything from the client is checked against an allowlist before it reaches
 * a query. Route handlers call this rather than reading params themselves.
 */
export function parseCardFilters(params: URLSearchParams): CardFilters {
  const status = params.get("status")
  const page = Number(params.get("page") ?? "1")

  return {
    status: CARD_STATUSES.includes(status as CardStatus)
      ? (status as CardStatus)
      : "all",
    merchantId: params.get("merchantId") ?? undefined,
    search: params.get("search") ?? undefined,
    page: Number.isFinite(page) && page > 0 ? page : 1,
  }
}

export function filterCards(filters: CardFilters): Card[] {
  const { status, merchantId, search } = filters
  const needle = search?.trim().toLowerCase()

  return store.cards.filter((card) => {
    if (status && status !== "all" && card.status !== status) return false
    if (merchantId && card.merchantId !== merchantId) return false

    if (needle) {
      const merchant = merchantById(card.merchantId)
      const haystack = [card.id, card.nickname, card.last4, merchant?.name ?? ""]
        .join(" ")
        .toLowerCase()
      if (!haystack.includes(needle)) return false
    }

    return true
  })
}

/** Newest first, so the card you just issued is at the top. */
function sortCards(cards: Card[]): Card[] {
  return [...cards].sort((a, b) => b.createdAt.localeCompare(a.createdAt))
}

export function queryCards(filters: CardFilters) {
  return paginate(sortCards(filterCards(filters)), filters.page, filters.pageSize)
}

export function cardById(id: string): Card | null {
  return store.cards.find((card) => card.id === id) ?? null
}

/** Next id in the `card_000001` sequence the seed data already uses. */
function nextSequence(): number {
  return (
    store.cards.reduce((highest, card) => {
      const n = Number(card.id.replace("card_", ""))
      return Number.isFinite(n) && n > highest ? n : highest
    }, 0) + 1
  )
}

/**
 * Issue a card and return the full number alongside it.
 *
 * This is the only place a full number exists. It is returned to the caller
 * for the single creation response and never written to the record — the
 * stored card carries the last four and a reference.
 */
export function issueCard(request: IssueCardRequest): {
  card: Card
  cardNumber: string
} {
  const cardNumber = generateCardNumber()
  const sequence = nextSequence()

  const card: Card = {
    id: `card_${String(sequence).padStart(6, "0")}`,
    nickname: request.nickname,
    merchantId: request.merchantId,
    spendLimit: request.spendLimit,
    // A card issued today has spent nothing.
    spend: 0,
    currency: request.currency,
    status: "active",
    last4: cardNumber.slice(-4),
    reference: `cn_${String(sequence).padStart(10, "0")}`,
    category: request.category,
    createdAt: new Date().toISOString(),
  }

  store.cards.push(card)
  return { card, cardNumber }
}

/**
 * Move a card to a new status, guarded by the state machine.
 *
 * The guard lives here rather than in the UI, so a stale tab or a curl cannot
 * bring a cancelled card back.
 */
export function transitionCard(
  card: Card,
  to: CardStatus,
): Validated<Card> {
  if (card.status === to) {
    return { ok: false, message: `That card is already ${to}.` }
  }
  if (!canTransition(card.status, to)) {
    return card.status === "cancelled"
      ? { ok: false, message: "A cancelled card cannot be changed." }
      : { ok: false, message: `A ${card.status} card cannot become ${to}.` }
  }

  card.status = to
  return { ok: true, value: card }
}
