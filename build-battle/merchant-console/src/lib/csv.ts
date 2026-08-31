import { merchantById } from "@/data/merchants"
import { Payment, PaymentFilters } from "@/data/types"
import { formatMoney } from "./money"

/**
 * CSV export for the payments table.
 *
 * Ops picks the columns and the scope; everything a client sends is checked
 * against the allowlist here before it reaches the serializer or the
 * filename. The card last four is off unless it is asked for by name.
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
 * What an export ships when nobody says otherwise. The card last four is
 * opt-in: most files go to a merchant, and it was the column ops had to
 * strip by hand every time.
 */
export const DEFAULT_EXPORT_COLUMNS: readonly ExportColumn[] =
  EXPORT_COLUMNS.filter((column) => column !== "last4")

export type ColumnSelection =
  | { ok: true; columns: ExportColumn[] }
  | { ok: false; error: string }

function isExportColumn(value: string): value is ExportColumn {
  return (EXPORT_COLUMNS as readonly string[]).includes(value)
}

/**
 * Column names arrive from the client, so they are checked against the
 * allowlist before they reach the serializer or the filename. Order is the
 * caller's, deduped: ops asked for a subset in the order they want to read it.
 */
export function parseExportColumns(raw: string | null): ColumnSelection {
  if (raw === null) return { ok: true, columns: [...DEFAULT_EXPORT_COLUMNS] }

  const requested = raw
    .split(",")
    .map((name) => name.trim())
    .filter(Boolean)

  if (requested.length === 0) {
    return { ok: false, error: "Select at least one column to export." }
  }

  const unknown = requested.find((name) => !isExportColumn(name))
  if (unknown) {
    return { ok: false, error: `Unknown column: ${unknown}.` }
  }

  const columns = requested.filter(
    (name, index): name is ExportColumn => requested.indexOf(name) === index,
  )
  return { ok: true, columns }
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

export type ExportScope = "filtered" | "all"

/**
 * The word in the middle of the filename, so a file says what is in it
 * without being opened. The status when there is one, since that is how ops
 * describes these files; otherwise whether it was narrowed at all.
 */
export function exportScopeLabel(
  scope: ExportScope,
  filters: PaymentFilters,
): string {
  if (scope === "all") return "all"
  if (filters.status && filters.status !== "all") return filters.status
  const narrowed = Boolean(
    filters.merchantId || filters.search || filters.from || filters.to,
  )
  return narrowed ? "filtered" : "all"
}

/**
 * Dated in UTC, so two exports on the same day collide by design. The scope
 * is derived from allowlisted values, but it is slugified anyway: this string
 * goes into a header, and nothing client-shaped reaches a filename unchecked.
 */
export function exportFilename(scope = "all", date = new Date()): string {
  const slug = scope.toLowerCase().replace(/[^a-z0-9-]/g, "") || "all"
  return `payments-${slug}-${date.toISOString().slice(0, 10)}.csv`
}
