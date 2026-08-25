import { merchantById } from "@/data/merchants"
import { Payment, PaymentFilters } from "@/data/types"
import { formatMoney } from "./money"

/**
 * CSV export for the payments table.
 *
 * Ops chooses the columns and the scope (NWP-101). Everything the client sends
 * is checked here against EXPORT_COLUMNS before it reaches a header row or a
 * filename — this module is the allowlist.
 */

export const EXPORT_COLUMNS = [
  "id",
  "created_at",
  "merchant",
  "description",
  "status",
  "method",
  "card_brand",
  "last4",
  "amount",
  "currency",
] as const

export type ExportColumn = (typeof EXPORT_COLUMNS)[number]

/**
 * What a caller gets when it asks for no columns in particular.
 *
 * Card last four is deliberately absent: a bare export URL, a bookmark, or a
 * forgotten checkbox must not put card data in a file bound for a merchant.
 * Ops opts in to last4 per export.
 */
export const DEFAULT_EXPORT_COLUMNS: readonly ExportColumn[] =
  EXPORT_COLUMNS.filter((column) => column !== "last4")

/** Human labels for the column picker. Display only. */
export const EXPORT_COLUMN_LABELS: Record<ExportColumn, string> = {
  id: "Payment ID",
  created_at: "Created (UTC)",
  merchant: "Merchant",
  description: "Description",
  status: "Status",
  method: "Method",
  card_brand: "Card brand",
  last4: "Card last four",
  amount: "Amount",
  currency: "Currency",
}

export const EXPORT_SCOPES = ["current", "all"] as const

export type ExportScope = (typeof EXPORT_SCOPES)[number]

function isExportColumn(value: string): value is ExportColumn {
  return (EXPORT_COLUMNS as readonly string[]).includes(value)
}

/**
 * Turn the client's `columns` parameter into a validated column list.
 *
 * An absent parameter means "the default set". A present one is filtered
 * against the allowlist and deduplicated, keeping the order asked for, so an
 * unrecognised name is dropped rather than passed along. A parameter that
 * survives as an empty list is the caller's problem to reject — see the route.
 */
export function parseExportColumns(
  param: string | null | undefined,
): ExportColumn[] {
  if (param === null || param === undefined) return [...DEFAULT_EXPORT_COLUMNS]

  const seen = new Set<ExportColumn>()
  for (const name of param.split(",")) {
    const trimmed = name.trim()
    if (isExportColumn(trimmed)) seen.add(trimmed)
  }
  return [...seen]
}

/** Turn the client's `scope` parameter into one of two known values. */
export function parseExportScope(
  param: string | null | undefined,
): ExportScope {
  return param === "all" ? "all" : "current"
}

/**
 * The word that goes in the filename between "payments" and the date.
 *
 * Derived from values that have already been through parseFilters, and from
 * the presence of the free-text filters rather than their contents, so nothing
 * a client typed can reach a filename.
 */
export function exportScopeToken(
  filters: PaymentFilters,
  scope: ExportScope,
): string {
  if (scope === "all") return "all"
  if (filters.status && filters.status !== "all") return filters.status
  const narrowed =
    filters.merchantId || filters.search || filters.from || filters.to
  return narrowed ? "filtered" : "all"
}

function escapeCell(value: string): string {
  if (/[",\n]/.test(value)) return `"${value.replace(/"/g, '""')}"`
  return value
}

function cell(payment: Payment, column: ExportColumn): string {
  switch (column) {
    case "id":
      return payment.id
    case "created_at":
      return payment.createdAt
    case "merchant":
      return merchantById(payment.merchantId)?.name ?? payment.merchantId
    case "description":
      return payment.description
    case "status":
      return payment.status
    case "method":
      return payment.method
    case "card_brand":
      return payment.cardBrand ?? ""
    case "last4":
      return payment.last4 ?? ""
    case "amount":
      return formatMoney(payment.amount, payment.currency)
    case "currency":
      return payment.currency
  }
}

export function toCsv(
  payments: Payment[],
  columns: readonly ExportColumn[] = EXPORT_COLUMNS,
): string {
  const header = columns.join(",")
  const rows = payments.map((payment) =>
    columns.map((column) => escapeCell(cell(payment, column))).join(","),
  )
  return [header, ...rows].join("\n")
}

/**
 * `payments-disputed-2026-08-13.csv`. The date is the UTC day, so the name
 * agrees with the rows inside it.
 */
export function exportFilename(date = new Date(), scope?: string): string {
  const day = date.toISOString().slice(0, 10)
  return scope ? `payments-${scope}-${day}.csv` : `payments-${day}.csv`
}
