import { merchantById } from "@/data/merchants"
import { Payment } from "@/data/types"
import { formatMoney } from "./money"

/**
 * CSV export for the payments table.
 *
 * Ops chooses which columns ship and whether the file covers the current
 * filter or every payment. Column names arrive from the client, so they are
 * checked against EXPORT_COLUMNS here before they reach a header row or a
 * filename. The card last four is off by default: most files go to a
 * merchant, and a merchant never needs it.
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

/** What ships when the request names no columns. Everything but the last four. */
export const DEFAULT_EXPORT_COLUMNS: readonly ExportColumn[] =
  EXPORT_COLUMNS.filter((column) => column !== "last4")

export const EXPORT_SCOPES = ["filtered", "all"] as const

export type ExportScope = (typeof EXPORT_SCOPES)[number]

export type ParsedColumns =
  | { ok: true; columns: readonly ExportColumn[] }
  | { ok: false; message: string }

function isExportColumn(value: string): value is ExportColumn {
  return (EXPORT_COLUMNS as readonly string[]).includes(value)
}

/**
 * Validate a comma-separated `columns` query value against the allowlist.
 *
 * Absent means the default set. Present but empty is a request for no
 * columns, which is refused rather than answered with a header-only file.
 * Request order is kept, so the caller decides the column order; duplicates
 * are dropped. The message is safe to show to a user.
 */
export function parseExportColumns(raw: string | null): ParsedColumns {
  if (raw === null) return { ok: true, columns: DEFAULT_EXPORT_COLUMNS }

  const names = raw
    .split(",")
    .map((name) => name.trim())
    .filter((name) => name.length > 0)

  if (names.length === 0) {
    return { ok: false, message: "Choose at least one column to export." }
  }

  const columns: ExportColumn[] = []
  for (const name of names) {
    if (!isExportColumn(name)) {
      return { ok: false, message: `Unknown export column: ${name}` }
    }
    if (!columns.includes(name)) columns.push(name)
  }

  return { ok: true, columns }
}

/** Anything but an explicit "all" exports the current filter. */
export function parseExportScope(raw: string | null): ExportScope {
  return raw === "all" ? "all" : "filtered"
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
 * `payments-<scope>-<UTC date>.csv`. The scope segment is built by the route
 * from values that have already passed an allowlist, never from a raw param.
 */
export function exportFilename(scope: string, date = new Date()): string {
  return `payments-${scope}-${date.toISOString().slice(0, 10)}.csv`
}
