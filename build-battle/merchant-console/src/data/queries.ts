import { canTransition } from "@/lib/cardStatus"
import { generateCardNumber } from "@/lib/luhn"
import { merchantById } from "./merchants"
import { store } from "./store"
import { Card, CardStatus, Currency, Payment, PaymentFilters, PaymentStatus } from "./types"

const STATUSES: readonly (PaymentStatus | "all")[] = [
  "all",
  "authorized",
  "captured",
  "refunded",
  "failed",
  "disputed",
]

/**
 * Anything from the client is checked against an allowlist before it reaches
 * a query. Route handlers call this rather than reading params themselves.
 */
export function parseFilters(params: URLSearchParams): PaymentFilters {
  const status = params.get("status")
  const sort = params.get("sort")
  const direction = params.get("direction")
  const page = Number(params.get("page") ?? "1")

  return {
    status: STATUSES.includes(status as PaymentStatus)
      ? (status as PaymentStatus)
      : "all",
    merchantId: params.get("merchantId") ?? undefined,
    search: params.get("search") ?? undefined,
    from: params.get("from") ?? undefined,
    to: params.get("to") ?? undefined,
    page: Number.isFinite(page) && page > 0 ? page : 1,
    sort: sort === "amount" ? "amount" : "createdAt",
    direction: direction === "asc" ? "asc" : "desc",
  }
}

/**
 * The one payment query builder. Every list, export, and metric goes through
 * it. A second implementation is a defect, not a shortcut.
 */

export const PAGE_SIZE = 20

export function filterPayments(filters: PaymentFilters): Payment[] {
  const { status, merchantId, search, from, to } = filters
  const needle = search?.trim().toLowerCase()

  return store.payments.filter((payment) => {
    if (status && status !== "all" && payment.status !== status) return false
    if (merchantId && payment.merchantId !== merchantId) return false
    if (from && payment.createdAt < from) return false
    if (to && payment.createdAt > to) return false

    if (needle) {
      const merchant = merchantById(payment.merchantId)
      const haystack = [
        payment.id,
        payment.description,
        payment.last4 ?? "",
        merchant?.name ?? "",
      ]
        .join(" ")
        .toLowerCase()
      if (!haystack.includes(needle)) return false
    }

    return true
  })
}

export function sortPayments(
  payments: Payment[],
  sort: PaymentFilters["sort"] = "createdAt",
  direction: PaymentFilters["direction"] = "desc",
): Payment[] {
  const factor = direction === "asc" ? 1 : -1
  return [...payments].sort((a, b) => {
    if (sort === "amount") {
      // Sort by the formatted amount so the order matches what the table shows.
      return String(a.amount).localeCompare(String(b.amount)) * factor
    }
    return a.createdAt.localeCompare(b.createdAt) * factor
  })
}

export function paginate<T>(rows: T[], page = 1, pageSize = PAGE_SIZE) {
  const total = rows.length
  const pageCount = Math.max(1, Math.ceil(total / pageSize))
  const current = Math.min(Math.max(1, page), pageCount)
  const start = (current - 1) * pageSize
  return {
    rows: rows.slice(start, start + pageSize),
    total,
    page: current,
    pageCount,
    pageSize,
  }
}

/** Filter, sort, and paginate in one call. Use this rather than composing by hand. */
export function queryPayments(filters: PaymentFilters) {
  const filtered = filterPayments(filters)
  const sorted = sortPayments(filtered, filters.sort, filters.direction)
  return paginate(sorted, filters.page, filters.pageSize)
}

export function paymentById(id: string) {
  return store.payments.find((p) => p.id === id) ?? null
}

export function refundsForPayment(paymentId: string) {
  return store.refunds.filter((r) => r.paymentId === paymentId)
}

export function disputeForPayment(paymentId: string) {
  return store.disputes.find((d) => d.paymentId === paymentId) ?? null
}

/**
 * Cards. Kept in the same module as the rest of the data access, next to
 * the payment queries above, per the file's actual purpose.
 */

const CARD_CURRENCIES: readonly Currency[] = ["USD", "EUR", "GBP"]
const CARD_STATUSES: readonly CardStatus[] = ["active", "frozen", "cancelled"]
const MAX_LIMIT_MINOR_UNITS = 5_000_000

export interface CreateCardInput {
  nickname: string
  merchantId: string
  limit: number
  currency: Currency
}

export type Validated<T> =
  | { ok: true; value: T }
  | { ok: false; error: string }

/**
 * Anything from the client is checked against an allowlist before it
 * reaches the store. Route handlers call this rather than trusting the body.
 */
export function validateCardInput(body: unknown): Validated<CreateCardInput> {
  if (typeof body !== "object" || body === null) {
    return { ok: false, error: "Request body must be an object." }
  }

  const { nickname, merchantId, limit, currency } = body as Record<
    string,
    unknown
  >

  if (typeof nickname !== "string" || nickname.trim().length === 0) {
    return { ok: false, error: "Nickname is required." }
  }
  if (typeof merchantId !== "string" || !merchantById(merchantId)) {
    return { ok: false, error: "A valid merchant is required." }
  }
  const merchant = merchantById(merchantId)!
  if (typeof limit !== "number" || !Number.isInteger(limit) || limit <= 0) {
    return {
      ok: false,
      error: "Limit must be a positive whole number of minor units.",
    }
  }
  if (limit > MAX_LIMIT_MINOR_UNITS) {
    return {
      ok: false,
      error: `Limit cannot exceed ${MAX_LIMIT_MINOR_UNITS} minor units.`,
    }
  }
  if (!CARD_CURRENCIES.includes(currency as Currency)) {
    return { ok: false, error: "Currency must be USD, EUR, or GBP." }
  }
  if (currency !== merchant.currency) {
    return {
      ok: false,
      error: `${merchant.name} settles in ${merchant.currency}. Issue this card in ${merchant.currency}.`,
    }
  }

  return {
    ok: true,
    value: {
      nickname: nickname.trim(),
      merchantId,
      limit,
      currency: currency as Currency,
    },
  }
}

export function listCards(): Card[] {
  return store.cards
}

export function cardById(id: string): Card | null {
  return store.cards.find((c) => c.id === id) ?? null
}

/**
 * Generates the full number, stores only the last four, and returns the
 * full number once. Nothing else in this module can ever read it again.
 */
export function createCard(input: CreateCardInput): { card: Card; number: string } {
  const number = generateCardNumber()
  const card: Card = {
    id: `card_${String(store.cards.length + 1).padStart(6, "0")}`,
    nickname: input.nickname,
    merchantId: input.merchantId,
    limit: input.limit,
    currency: input.currency,
    status: "active",
    last4: number.slice(-4),
    spend: 0,
    createdAt: new Date().toISOString(),
  }
  store.cards.push(card)
  return { card, number }
}

/** Guards the transition through cardStatus.ts before writing it. */
export function setCardStatus(
  id: string,
  status: CardStatus,
): Validated<Card> {
  const card = cardById(id)
  if (!card) return { ok: false, error: "Card not found." }
  if (!CARD_STATUSES.includes(status)) {
    return { ok: false, error: "Status must be active, frozen, or cancelled." }
  }
  if (!canTransition(card.status, status)) {
    return {
      ok: false,
      error: `Cannot move a ${card.status} card to ${status}.`,
    }
  }

  card.status = status
  return { ok: true, value: card }
}
