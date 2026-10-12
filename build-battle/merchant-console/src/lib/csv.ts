import { merchantById } from "@/data/merchants"
import { Payment, PaymentFilters, PaymentStatus } from "@/data/types"
import { formatMoney } from "./money"

/**
 * CSV export for the payments table.
 *
 * Ops chooses the columns and the scope (NWP-101). Column names arrive from
 * the client, so they are checked against EXPORT_COLUMNS before they reach a
 * cell or the header row. Card last four is off unless someone asks for it.
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

/** What ships when the client does not say. Last four stays out of merchant files. */
export const DEFAULT_EXPORT_COLUMNS: readonly ExportColumn[] =
  EXPORT_COLUMNS.filter((column) => column !== "last4")

export const EXPORT_SCOPES = ["current", "all"] as const

export type ExportScope = (typeof EXPORT_SCOPES)[number]

export function isExportScope(value: string): value is ExportScope {
  return (EXPORT_SCOPES as readonly string[]).includes(value)
}

/**
 * Parse a comma list of column names from the client.
 *
 * Absent means the default set. Empty, or any name not in EXPORT_COLUMNS,
 * returns null so the route can reject it. Duplicates collapse, and the
 * result is always in EXPORT_COLUMNS order whatever order the client sent.
 */
export function parseExportColumns(raw: string | null): ExportColumn[] | null {
  if (raw === null) return [...DEFAULT_EXPORT_COLUMNS]

  const requested = raw
    .split(",")
    .map((name) => name.trim())
    .filter(Boolean)
  if (requested.length === 0) return null

  const allowed: readonly string[] = EXPORT_COLUMNS
  if (requested.some((name) => !allowed.includes(name))) return null

  return EXPORT_COLUMNS.filter((column) => requested.includes(column))
}

export type ExportLabel = "all" | "filtered" | PaymentStatus

/**
 * The scope word that goes into the filename. Built only from allowlisted
 * values, never from the merchant id or the search text.
 */
export function exportLabel(
  scope: ExportScope,
  filters: PaymentFilters,
): ExportLabel {
  if (scope === "all") return "all"
  if (filters.status && filters.status !== "all") return filters.status
  if (filters.merchantId || filters.search?.trim() || filters.from || filters.to)
    return "filtered"
  return "all"
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

export function exportFilename(date = new Date(), label?: ExportLabel): string {
  const day = date.toISOString().slice(0, 10)
  return label ? `payments-${label}-${day}.csv` : `payments-${day}.csv`
}
