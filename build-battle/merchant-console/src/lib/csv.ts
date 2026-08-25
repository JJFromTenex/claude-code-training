import { merchantById } from "@/data/merchants"
import { Payment, PaymentFilters } from "@/data/types"
import { formatMinorUnits } from "./money"

/**
 * CSV export for the payments table.
 *
 * The column set and the scope arrive from the client, so both are checked
 * against the allowlists here before they reach the serializer or the
 * filename. Client-side checks in the dialog are convenience, never
 * enforcement.
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

/** Header the dialog shows beside each checkbox. */
export const EXPORT_COLUMN_LABELS: Record<ExportColumn, string> = {
  id: "Payment ID",
  created_at: "Created at (UTC)",
  merchant: "Merchant",
  description: "Description",
  status: "Status",
  method: "Method",
  card_brand: "Card brand",
  last4: "Card last four",
  amount: "Amount",
  currency: "Currency",
}

/**
 * Everything except the card last four. A file leaves here safe to send to a
 * merchant unless someone deliberately asks for the card digits, which is the
 * hand-scrubbing step NWP-101 removes.
 */
export const DEFAULT_EXPORT_COLUMNS: readonly ExportColumn[] =
  EXPORT_COLUMNS.filter((column) => column !== "last4")

export const EXPORT_SCOPES = ["filtered", "all"] as const

export type ExportScope = (typeof EXPORT_SCOPES)[number]

function isExportColumn(value: string): value is ExportColumn {
  return (EXPORT_COLUMNS as readonly string[]).includes(value)
}

/**
 * Turn the client's `columns` param into a validated set.
 *
 * Unknown names are dropped rather than rejected, duplicates collapse, and the
 * result is always in `EXPORT_COLUMNS` order so two identical requests produce
 * identical files. An absent param means the safe default, not every column: a
 * bookmarked link from before this ticket must not start shipping card digits
 * again.
 */
export function parseExportColumns(param: string | null): ExportColumn[] {
  if (param === null) return [...DEFAULT_EXPORT_COLUMNS]
  const requested = new Set(
    param
      .split(",")
      .map((name) => name.trim())
      .filter(isExportColumn),
  )
  return EXPORT_COLUMNS.filter((column) => requested.has(column))
}

/** Anything that is not an exact scope name falls back to the current filter. */
export function parseExportScope(param: string | null): ExportScope {
  return param === "all" ? "all" : "filtered"
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
      // Minor units are formatted once, here, at the edge. The symbol stays
      // out of it because `currency` is its own column.
      return formatMinorUnits(payment.amount)
    case "currency":
      return payment.currency
  }
}

export function toCsv(
  payments: Payment[],
  columns: readonly ExportColumn[] = DEFAULT_EXPORT_COLUMNS,
): string {
  const header = columns.join(",")
  const rows = payments.map((payment) =>
    columns.map((column) => escapeCell(cell(payment, column))).join(","),
  )
  return [header, ...rows].join("\n")
}

/**
 * The middle segment of the filename, describing what the file contains.
 *
 * Both inputs are already allowlisted — scope by `parseExportScope`, status by
 * `parseFilters` — so nothing raw from the client reaches a filename.
 */
export function exportSegment(
  scope: ExportScope,
  status: PaymentFilters["status"],
): string {
  if (scope === "all") return "all"
  return status && status !== "all" ? status : "filtered"
}

/**
 * `payments-disputed-2026-08-13.csv`. The date is the UTC day, matching how
 * everything else in this codebase buckets time.
 */
export function exportFilename(segment: string, date = new Date()): string {
  const safe = /^[a-z0-9-]{1,32}$/.test(segment) ? segment : "filtered"
  return `payments-${safe}-${date.toISOString().slice(0, 10)}.csv`
}
