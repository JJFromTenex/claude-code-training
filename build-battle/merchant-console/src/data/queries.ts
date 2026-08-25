import {
  CardInput,
  canTransition,
  generateCardNumber,
  validateCardInput,
} from "@/lib/cards"
import { merchantById } from "./merchants"
import { store } from "./store"
import {
  Card,
  CardFilters,
  CardStatus,
  Payment,
  PaymentFilters,
  PaymentStatus,
} from "./types"

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

const CARD_STATUSES: readonly (CardStatus | "all")[] = [
  "all",
  "active",
  "frozen",
  "cancelled",
]

/** Same allowlist shape as `parseFilters()` above. */
export function parseCardFilters(params: URLSearchParams): CardFilters {
  const status = params.get("status")
  const page = Number(params.get("page") ?? "1")

  return {
    status: CARD_STATUSES.includes(status as CardStatus)
      ? (status as CardStatus)
      : "all",
    merchantId: params.get("merchantId") ?? undefined,
    page: Number.isFinite(page) && page > 0 ? page : 1,
  }
}

export function filterCards(filters: CardFilters): Card[] {
  const { status, merchantId } = filters
  return store.cards.filter((card) => {
    if (status && status !== "all" && card.status !== status) return false
    if (merchantId && card.merchantId !== merchantId) return false
    return true
  })
}

/** Filter and paginate in one call, reusing the same `paginate()` payments use. */
export function queryCards(filters: CardFilters) {
  const filtered = filterCards(filters)
  const sorted = [...filtered].sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  return paginate(sorted, filters.page, filters.pageSize)
}

export function cardById(id: string): Card | null {
  return store.cards.find((c) => c.id === id) ?? null
}

export type IssueCardResult =
  | { ok: true; card: Card; number: string }
  | { ok: false; error: string }

/** Keyed on a client idempotency key so a retry returns the first result, not a second card. */
const issueIdempotencyCache = new Map<string, IssueCardResult>()

/** Validates, generates the number server-side, stores the card without it — the one-time reveal. */
export function issueCard(
  input: Partial<CardInput>,
  idempotencyKey?: string,
): IssueCardResult {
  if (idempotencyKey) {
    const cached = issueIdempotencyCache.get(idempotencyKey)
    if (cached) return cached
  }

  const result = validateCardInput(input)
  if (!result.ok) return { ok: false, error: result.error }

  const number = generateCardNumber()
  const now = new Date().toISOString()
  const card: Card = {
    id: `card_${crypto.randomUUID().slice(0, 8)}`,
    nickname: result.value.nickname,
    merchantId: result.value.merchantId,
    last4: number.slice(-4),
    // Opaque and unrelated to the number's digits — the BIN is always 4242,
    // so a reference built from real digits plus last4 would reconstruct
    // the full PAN. This has none of the number in it, by construction.
    reference: `ref_${crypto.randomUUID().replace(/-/g, "").slice(0, 8)}`,
    spendLimit: result.value.spendLimit,
    currency: result.value.currency,
    spent: 0,
    status: "active",
    category: result.value.category,
    createdAt: now,
    history: [{ status: "active", at: now }],
  }
  store.cards.push(card)

  const outcome: IssueCardResult = { ok: true, card, number }
  if (idempotencyKey) issueIdempotencyCache.set(idempotencyKey, outcome)
  return outcome
}

export type SetCardStatusResult =
  | { ok: true; card: Card }
  | { ok: false; error: string; notFound?: boolean }

/** Guards the `active ⇄ frozen`/`cancelled` state machine on the server. */
export function setCardStatus(id: string, next: CardStatus): SetCardStatusResult {
  const card = cardById(id)
  if (!card) return { ok: false, error: "Card not found.", notFound: true }

  if (!canTransition(card.status, next)) {
    return {
      ok: false,
      error: `Cannot move a card from ${card.status} to ${next}.`,
    }
  }

  card.status = next
  card.history.push({ status: next, at: new Date().toISOString() })
  return { ok: true, card }
}
