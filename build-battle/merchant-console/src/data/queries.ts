import { DEFAULT_EXPORT_COLUMNS, EXPORT_COLUMNS, ExportColumn } from "@/lib/csv"
import { merchantById } from "./merchants"
import { store } from "./store"
import { Payment, PaymentFilters, PaymentStatus } from "./types"

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

export type ExportScope = "filter" | "all"

export interface ExportOptions {
  columns: ExportColumn[]
  scope: ExportScope
}

/**
 * The allowlist for the export's own parameters, alongside `parseFilters` so
 * there is one place client input is checked. A column name reaches a header
 * row and a scope reaches a filename, so neither may be echoed unvalidated.
 *
 * Order comes from the client — ops arranges a file for their spreadsheet —
 * but every value is a literal from `EXPORT_COLUMNS`. Naming no columns is
 * not the same as naming only invalid ones: the first gets the default set,
 * the second returns empty for the caller to reject.
 */
export function parseExportOptions(params: URLSearchParams): ExportOptions {
  const requested = params.get("columns")
  const scope = params.get("scope") === "all" ? "all" : "filter"

  if (requested === null) {
    return { columns: [...DEFAULT_EXPORT_COLUMNS], scope }
  }

  const columns: ExportColumn[] = []
  for (const name of requested.split(",")) {
    const column = name.trim()
    if (!EXPORT_COLUMNS.includes(column as ExportColumn)) continue
    if (columns.includes(column as ExportColumn)) continue
    columns.push(column as ExportColumn)
  }

  return { columns, scope }
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
