import { merchantById } from "@/data/merchants"
import { Payment, PaymentFilters } from "@/data/types"
import { formatMoney } from "./money"

/**
 * CSV export for the payments table.
 *
 * Ops chooses the columns and the scope. Column names arrive from the client,
 * so they are checked against EXPORT_COLUMNS before they reach the serializer
 * or the filename.
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
 * What an export ships when ops does not choose. The card last four is off:
 * most of these files go to a merchant, and adding it back is a decision
 * someone makes on purpose rather than one they forget to undo.
 */
export const DEFAULT_EXPORT_COLUMNS: readonly ExportColumn[] =
  EXPORT_COLUMNS.filter((column) => column !== "last4")

/** Current filter, or every payment on the platform. */
export type ExportScope = "filter" | "all"

export function isExportColumn(value: string): value is ExportColumn {
  return (EXPORT_COLUMNS as readonly string[]).includes(value)
}

export type ColumnSelection =
  | { ok: true; columns: ExportColumn[] }
  | { ok: false; message: string }

/**
 * Turn the `columns` query param into a checked selection. The raw string is
 * client input: an unrecognized name is refused rather than dropped, so a
 * stale link fails loudly instead of quietly shipping the wrong file.
 */
export function selectColumns(raw: string | null): ColumnSelection {
  if (raw === null) return { ok: true, columns: [...DEFAULT_EXPORT_COLUMNS] }

  const requested = raw
    .split(",")
    .map((column) => column.trim())
    .filter(Boolean)

  if (requested.length === 0) {
    return { ok: false, message: "Choose at least one column to export." }
  }
  if (!requested.every(isExportColumn)) {
    return { ok: false, message: "That export column is not recognized." }
  }
  return { ok: true, columns: requested }
}

/**
 * The scope segment of the filename. Names the status when that is what
 * narrowed the export, because that is the distinction ops cares about when
 * two files land in the same downloads folder on the same day.
 */
export function describeScope(
  scope: ExportScope,
  filters: PaymentFilters,
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
 * The descriptor ends up in a Content-Disposition header, so only what a
 * filename can safely carry survives.
 */
function slug(descriptor: string): string {
  return descriptor
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
}

export function exportFilename(date = new Date(), descriptor?: string): string {
  const day = date.toISOString().slice(0, 10)
  const scope = descriptor ? slug(descriptor) : ""
  return scope ? `payments-${scope}-${day}.csv` : `payments-${day}.csv`
}
