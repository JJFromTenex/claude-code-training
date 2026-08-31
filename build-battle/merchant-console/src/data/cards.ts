import {
  generateCardNumber,
  generateNumberReference,
  isValidCardTransition,
  last4Of,
} from "@/lib/cards"
import { merchantById } from "./merchants"
import { paginate } from "./queries"
import { store } from "./store"
import { Card, CardFilters, CardStatus, Currency } from "./types"

/**
 * The card query builder and the two card mutations.
 *
 * Everything a client can send — status, sort, limit, currency, a status
 * transition — is validated here against an allowlist before it reaches the
 * store. The route handlers stay thin and call into this.
 */

/**
 * The status allowlist. Exported so the filter UI and the validator cannot
 * drift apart — a status the buttons offer is a status the server accepts.
 */
export const CARD_STATUSES: readonly (CardStatus | "all")[] = [
  "all",
  "active",
  "frozen",
  "cancelled",
]

const CURRENCIES: readonly Currency[] = ["USD", "EUR", "GBP"]

/** A card's limit is capped so a typo cannot issue a card for millions. */
export const MAX_CARD_LIMIT = 5_000_000

export function parseCardFilters(params: URLSearchParams): CardFilters {
  const status = params.get("status")
  const sort = params.get("sort")
  const direction = params.get("direction")
  const page = Number(params.get("page") ?? "1")

  return {
    status: CARD_STATUSES.includes(status as CardStatus)
      ? (status as CardStatus)
      : "all",
    merchantId: params.get("merchantId") ?? undefined,
    search: params.get("search") ?? undefined,
    page: Number.isFinite(page) && page > 0 ? page : 1,
    sort: sort === "limit" ? "limit" : "createdAt",
    direction: direction === "asc" ? "asc" : "desc",
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

export function sortCards(
  cards: Card[],
  sort: CardFilters["sort"] = "createdAt",
  direction: CardFilters["direction"] = "desc",
): Card[] {
  const factor = direction === "asc" ? 1 : -1
  return [...cards].sort((a, b) => {
    if (sort === "limit") return (a.limit - b.limit) * factor
    return a.createdAt.localeCompare(b.createdAt) * factor
  })
}

/** Filter, sort, and paginate in one call. */
export function queryCards(filters: CardFilters) {
  const filtered = filterCards(filters)
  const sorted = sortCards(filtered, filters.sort, filters.direction)
  return paginate(sorted, filters.page, filters.pageSize)
}

export function cardById(id: string) {
  return store.cards.find((c) => c.id === id) ?? null
}

export function cardsForMerchant(merchantId: string) {
  return store.cards.filter((c) => c.merchantId === merchantId)
}

export interface CreateCardInput {
  nickname: unknown
  merchantId: unknown
  limit: unknown
  currency: unknown
  category?: unknown
  /** Optional; a repeat of the same key returns the card already issued. */
  idempotencyKey?: unknown
}

/** A rejected write names the field, so the dialog can say what to fix. */
export interface ValidationError {
  field: string
  message: string
}

type Result<T> = { ok: true; value: T } | { ok: false; error: ValidationError }

/**
 * Validate a creation request. Called by the route before anything is
 * generated: a card that fails validation must not consume a number.
 */
function validateCreate(input: CreateCardInput): Result<{
  nickname: string
  merchantId: string
  limit: number
  currency: Currency
  category: string | null
}> {
  const nickname = typeof input.nickname === "string" ? input.nickname.trim() : ""
  if (!nickname) {
    return {
      ok: false,
      error: { field: "nickname", message: "Give the card a nickname." },
    }
  }

  if (typeof input.merchantId !== "string" || !merchantById(input.merchantId)) {
    return {
      ok: false,
      error: { field: "merchantId", message: "Choose a merchant." },
    }
  }

  // The limit arrives as minor units. A string, a float, or a negative is a
  // client that did not convert at its boundary.
  const limit = input.limit
  if (typeof limit !== "number" || !Number.isInteger(limit)) {
    return {
      ok: false,
      error: {
        field: "limit",
        message: "Spend limit must be a whole number of minor units.",
      },
    }
  }
  if (limit <= 0) {
    return {
      ok: false,
      error: { field: "limit", message: "Spend limit must be more than zero." },
    }
  }
  if (limit > MAX_CARD_LIMIT) {
    return {
      ok: false,
      error: {
        field: "limit",
        message: `Spend limit cannot exceed ${MAX_CARD_LIMIT} minor units.`,
      },
    }
  }

  if (!CURRENCIES.includes(input.currency as Currency)) {
    return {
      ok: false,
      error: {
        field: "currency",
        message: `Currency must be one of ${CURRENCIES.join(", ")}.`,
      },
    }
  }

  // A card settles in the merchant's own currency. The form defaults to it,
  // but the form is a convenience — a mismatched pair reaching here is either
  // a stale client or a crafted request, and both are rejected.
  const merchant = merchantById(input.merchantId)!
  if (input.currency !== merchant.currency) {
    return {
      ok: false,
      error: {
        field: "currency",
        message: `${merchant.name} settles in ${merchant.currency}, so the card cannot be issued in ${input.currency}.`,
      },
    }
  }

  const category =
    typeof input.category === "string" && input.category.trim()
      ? input.category.trim()
      : null

  return {
    ok: true,
    value: {
      nickname,
      merchantId: input.merchantId,
      limit,
      currency: input.currency as Currency,
      category,
    },
  }
}

/**
 * Ids come from a counter, not from `cards.length` — length repeats itself the
 * moment anything is ever removed, and a repeated card id is a very bad day.
 */
let issuedCount = 0

function nextCardId(): string {
  issuedCount = Math.max(issuedCount, store.cards.length) + 1
  return `card_${String(issuedCount).padStart(4, "0")}`
}

/**
 * Issue a card.
 *
 * The full number is returned here and nowhere else — it is deliberately not
 * a field on the stored record, so there is nothing to leak from a later read.
 */
export function createCard(
  input: CreateCardInput,
): Result<{ card: Card; number: string | null; duplicate: boolean }> {
  // A resubmitted form must not issue a second card. The key is checked before
  // validation so a retry behaves the same as the request it repeats.
  const key = typeof input.idempotencyKey === "string" ? input.idempotencyKey : null
  if (key) {
    const existingId = store.cardIssueKeys.get(key)
    if (existingId) {
      const existing = cardById(existingId)
      if (existing) {
        // Deliberately no number: the reveal already happened, and repeating a
        // request is not a second chance to see it.
        return { ok: true, value: { card: existing, number: null, duplicate: true } }
      }
    }
  }

  const validated = validateCreate(input)
  if (!validated.ok) return validated

  const number = generateCardNumber()
  const createdAt = new Date().toISOString()
  const card: Card = {
    id: nextCardId(),
    nickname: validated.value.nickname,
    merchantId: validated.value.merchantId,
    last4: last4Of(number),
    reference: generateNumberReference(),
    limit: validated.value.limit,
    spent: 0,
    currency: validated.value.currency,
    status: "active",
    createdAt,
    category: validated.value.category,
    history: [{ status: "active", at: createdAt }],
  }

  store.cards.push(card)
  if (key) store.cardIssueKeys.set(key, card.id)
  return { ok: true, value: { card, number, duplicate: false } }
}

/**
 * Move a card through the state machine. The guard lives here rather than in
 * the UI: a button that is hidden is not a rule.
 */
export function transitionCardStatus(
  id: string,
  to: unknown,
): Result<Card> | null {
  const card = cardById(id)
  if (!card) return null

  if (!CARD_STATUSES.includes(to as CardStatus) || to === "all") {
    return {
      ok: false,
      error: { field: "status", message: "Unknown status." },
    }
  }

  const next = to as CardStatus
  if (!isValidCardTransition(card.status, next)) {
    return {
      ok: false,
      error: {
        field: "status",
        message: `A ${card.status} card cannot become ${next}.`,
      },
    }
  }

  card.status = next
  card.history.push({ status: next, at: new Date().toISOString() })
  return { ok: true, value: card }
}
