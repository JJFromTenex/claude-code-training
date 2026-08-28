import { merchantById } from "@/data/merchants"
import { Payment, PaymentStatus } from "@/data/types"
import { formatMoney } from "./money"

/**
 * CSV export for the payments table.
 *
 * Ops chooses the columns and the scope; both arrive from the client, so both
 * are checked against the allowlists here before they reach the serializer or
 * the filename. The card last four is off unless it is asked for by name — a
 * file bound for a merchant should need no hand editing.
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

/** Every column except the card last four, which is opt-in. */
export const DEFAULT_EXPORT_COLUMNS: readonly ExportColumn[] = EXPORT_COLUMNS.filter(
  (column) => column !== "last4",
)

export const EXPORT_SCOPES = ["filtered", "all"] as const

export type ExportScope = (typeof EXPORT_SCOPES)[number]

/**
 * Column names arrive from the client. Anything not in EXPORT_COLUMNS is
 * dropped rather than rejected, the way a bad status falls back in
 * parseFilters, so a stale link still exports something sensible. An empty
 * result stays empty: falling back to the defaults here would ship columns ops
 * had deliberately deselected. The caller decides what to do with nothing.
 */
export function parseExportColumns(
  raw: string | null | undefined,
): readonly ExportColumn[] {
  if (raw == null) return DEFAULT_EXPORT_COLUMNS

  const seen = new Set<ExportColumn>()
  for (const name of raw.split(",")) {
    const column = name.trim()
    if (EXPORT_COLUMNS.includes(column as ExportColumn)) {
      seen.add(column as ExportColumn)
    }
  }
  return [...seen]
}

/** Anything but the exact word widens nothing — a mangled link stays scoped. */
export function parseExportScope(raw: string | null | undefined): ExportScope {
  return raw === "all" ? "all" : "filtered"
}

/**
 * The middle of the filename. Scope wins over status: an all-payments file
 * labelled "disputed" would misdescribe itself. Both inputs are already
 * allowlisted, so no client string reaches the filename.
 */
export function exportSegment(
  scope: ExportScope,
  status?: PaymentStatus | "all",
): string {
  if (scope === "all") return "all"
  return status && status !== "all" ? status : "filtered"
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
  // No columns is no file. Without this every row would be a blank line.
  if (columns.length === 0) return ""

  const header = columns.join(",")
  const rows = payments.map((payment) =>
    columns.map((column) => escapeCell(cell(payment, column))).join(","),
  )
  return [header, ...rows].join("\n")
}

export function exportFilename(
  date = new Date(),
  segment?: string | null,
): string {
  const day = date.toISOString().slice(0, 10)
  return segment ? `payments-${segment}-${day}.csv` : `payments-${day}.csv`
}
