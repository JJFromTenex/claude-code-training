import { parseAmountToMinorUnits, sumMinorUnits } from "@/lib/money"
import { merchantById } from "./merchants"
import { store } from "./store"
import {
  CardBrand,
  Currency,
  Payment,
  PaymentFilters,
  PaymentMethod,
  PaymentSort,
  PaymentStatus,
  PaymentSummary,
} from "./types"

const STATUSES: readonly (PaymentStatus | "all")[] = [
  "all",
  "authorized",
  "captured",
  "refunded",
  "failed",
  "disputed",
]

export const METHODS: readonly (PaymentMethod | "all")[] = [
  "all",
  "card",
  "wallet",
  "bank_transfer",
]

export const CARD_BRANDS: readonly (CardBrand | "all")[] = [
  "all",
  "visa",
  "mastercard",
  "amex",
]

export const CURRENCIES: readonly Currency[] = ["USD", "EUR", "GBP"]

const SORTS: readonly PaymentSort[] = ["createdAt", "amount", "merchant", "status"]

/**
 * Anything from the client is checked against an allowlist before it reaches
 * a query. Route handlers call this rather than reading params themselves.
 *
 * Two slicers are linked, and the linkage is enforced here rather than in the
 * UI: a card brand is meaningless without method=card, and an amount range is
 * meaningless without a currency to compare within.
 */
export function parseFilters(params: URLSearchParams): PaymentFilters {
  const status = params.get("status")
  const method = params.get("method")
  const cardBrand = params.get("cardBrand")
  const currency = params.get("currency")
  const sort = params.get("sort")
  const direction = params.get("direction")
  const page = Number(params.get("page") ?? "1")

  const safeMethod = METHODS.includes(method as PaymentMethod)
    ? (method as PaymentMethod)
    : "all"

  const safeBrand =
    safeMethod === "card" && CARD_BRANDS.includes(cardBrand as CardBrand)
      ? (cardBrand as CardBrand)
      : "all"

  const safeCurrency = CURRENCIES.includes(currency as Currency)
    ? (currency as Currency)
    : undefined

  return {
    status: STATUSES.includes(status as PaymentStatus)
      ? (status as PaymentStatus)
      : "all",
    merchantId: params.get("merchantId") ?? undefined,
    search: params.get("search") ?? undefined,
    from: params.get("from") ?? undefined,
    to: params.get("to") ?? undefined,
    method: safeMethod,
    cardBrand: safeBrand,
    currency: safeCurrency,
    minAmount: parseBoundary(params.get("minAmount"), safeCurrency),
    maxAmount: parseBoundary(params.get("maxAmount"), safeCurrency),
    page: Number.isFinite(page) && page > 0 ? page : 1,
    sort: SORTS.includes(sort as PaymentSort) ? (sort as PaymentSort) : "createdAt",
    direction: direction === "asc" ? "asc" : "desc",
  }
}

/**
 * An amount arrives from the client as display units ("250" or "250.00") and
 * is converted to minor units exactly once, here. Unparseable input is dropped
 * rather than coerced to 0, which would silently filter everything out.
 */
function parseBoundary(
  raw: string | null,
  currency: Currency | undefined,
): number | undefined {
  if (!raw || !currency) return undefined
  return parseAmountToMinorUnits(raw) ?? undefined
}

/**
 * The one payment query builder. Every list, export, and metric goes through
 * it. A second implementation is a defect, not a shortcut.
 */

export const PAGE_SIZE = 20

export function filterPayments(filters: PaymentFilters): Payment[] {
  const {
    status,
    merchantId,
    search,
    from,
    to,
    method,
    cardBrand,
    currency,
    minAmount,
    maxAmount,
  } = filters
  const needle = search?.trim().toLowerCase()

  return store.payments.filter((payment) => {
    if (status && status !== "all" && payment.status !== status) return false
    if (merchantId && payment.merchantId !== merchantId) return false
    if (from && payment.createdAt < from) return false
    if (to && payment.createdAt > to) return false
    if (method && method !== "all" && payment.method !== method) return false
    if (cardBrand && cardBrand !== "all" && payment.cardBrand !== cardBrand)
      return false
    if (currency && payment.currency !== currency) return false
    if (minAmount !== undefined && payment.amount < minAmount) return false
    if (maxAmount !== undefined && payment.amount > maxAmount) return false

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
      // Numeric, not lexicographic: as strings, "9" sorts above "100".
      return (a.amount - b.amount) * factor
    }
    if (sort === "merchant") {
      const left = merchantById(a.merchantId)?.name ?? a.merchantId
      const right = merchantById(b.merchantId)?.name ?? b.merchantId
      return left.localeCompare(right) * factor
    }
    if (sort === "status") {
      return a.status.localeCompare(b.status) * factor
    }
    return a.createdAt.localeCompare(b.createdAt) * factor
  })
}

/**
 * Count and money totals for a filtered set, grouped by currency.
 *
 * Callers pass the filtered rows, never a page of them — a total computed from
 * the visible page is the bug this feature exists to remove. Amounts are never
 * summed across currencies, so a mixed set returns one entry per currency.
 */
export function summarizePayments(payments: Payment[]): PaymentSummary {
  const byCurrency = new Map<Currency, number[]>()

  for (const payment of payments) {
    const amounts = byCurrency.get(payment.currency)
    if (amounts) amounts.push(payment.amount)
    else byCurrency.set(payment.currency, [payment.amount])
  }

  const totals = CURRENCIES.filter((currency) => byCurrency.has(currency)).map(
    (currency) => ({
      currency,
      amount: sumMinorUnits(byCurrency.get(currency) ?? []),
    }),
  )

  return { count: payments.length, totals }
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
