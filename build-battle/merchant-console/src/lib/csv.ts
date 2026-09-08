import { merchantById } from "@/data/merchants"
import { Payment, PaymentFilters } from "@/data/types"
import { formatMoney } from "./money"

/**
 * CSV export for the payments table.
 *
 * Ops chooses the columns and the scope (NWP-101). Both arrive from the
 * client, so everything here checks against an allowlist before a name
 * reaches the serializer or the filename.
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
 * What ships when nobody chooses. The card last four is opt-in: most files
 * go to a merchant, and one that leaks it has to be scrubbed by hand.
 */
export const DEFAULT_EXPORT_COLUMNS: readonly ExportColumn[] =
  EXPORT_COLUMNS.filter((column) => column !== "last4")

export const EXPORT_SCOPES = ["current", "all"] as const

export type ExportScope = (typeof EXPORT_SCOPES)[number]

export type ParseResult<T> =
  | { ok: true; value: T }
  | { ok: false; message: string }

function isExportColumn(value: string): value is ExportColumn {
  return (EXPORT_COLUMNS as readonly string[]).includes(value)
}

/**
 * Parse the `columns` query param: comma-separated names, in the order the
 * file should have them. Absent means the default set. Present but empty is
 * a request for an empty file, which is refused rather than honoured.
 */
export function parseExportColumns(
  raw: string | null,
): ParseResult<ExportColumn[]> {
  if (raw === null) return { ok: true, value: [...DEFAULT_EXPORT_COLUMNS] }

  const names = raw
    .split(",")
    .map((name) => name.trim())
    .filter(Boolean)
  if (names.length === 0) {
    return { ok: false, message: "Choose at least one column to export." }
  }

  const unknown = names.filter((name) => !isExportColumn(name))
  if (unknown.length > 0) {
    return { ok: false, message: `Unknown column: ${unknown.join(", ")}.` }
  }

  // Keep the requested order; drop a repeat rather than writing it twice.
  return { ok: true, value: Array.from(new Set(names.filter(isExportColumn))) }
}

/** Parse the `scope` query param. Absent means the current filter. */
export function parseExportScope(raw: string | null): ParseResult<ExportScope> {
  if (raw === null) return { ok: true, value: "current" }
  if ((EXPORT_SCOPES as readonly string[]).includes(raw)) {
    return { ok: true, value: raw as ExportScope }
  }
  return { ok: false, message: `Unknown scope: ${raw}. Use "current" or "all".` }
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
 * The word in the filename that says what the file holds: `all` for every
 * payment, the status for a status-filtered export, nothing otherwise.
 */
export function exportLabel(
  scope: ExportScope,
  status: PaymentFilters["status"] = "all",
): string | undefined {
  if (scope === "all") return "all"
  if (status && status !== "all") return status
  return undefined
}

export function exportFilename(date = new Date(), label?: string): string {
  const day = date.toISOString().slice(0, 10)
  return label ? `payments-${label}-${day}.csv` : `payments-${day}.csv`
}
