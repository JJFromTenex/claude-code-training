import { merchantById } from "@/data/merchants"
import { Payment } from "@/data/types"
import { formatMoney } from "./money"

/**
 * CSV export for the payments table.
 *
 * Ops chooses the columns. Requests name them, so the names are checked
 * against EXPORT_COLUMNS before they reach a serializer or a filename —
 * a name that is not on the list is dropped, never passed through.
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
 * What ops gets when they do not choose. The card last four is off: most
 * files go to a merchant, and every one that carries it has to be cleaned
 * up by hand first.
 */
export const DEFAULT_EXPORT_COLUMNS: readonly ExportColumn[] =
  EXPORT_COLUMNS.filter((column) => column !== "last4")

function isExportColumn(value: string): value is ExportColumn {
  return (EXPORT_COLUMNS as readonly string[]).includes(value)
}

/**
 * Turn a client-supplied `columns` parameter into a column list.
 *
 * Unknown names are dropped rather than trusted; order follows the request
 * so ops gets the file laid out the way they asked. An absent parameter
 * means "the defaults", but an explicit selection that survives to nothing
 * returns an empty list — the caller decides that is an error rather than
 * quietly exporting every column.
 */
export function parseExportColumns(raw: string | null): ExportColumn[] {
  if (raw === null) return [...DEFAULT_EXPORT_COLUMNS]

  const seen = new Set<ExportColumn>()
  for (const name of raw.split(",")) {
    const trimmed = name.trim()
    if (isExportColumn(trimmed)) seen.add(trimmed)
  }
  return [...seen]
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
 * `payments-disputed-2026-08-13.csv`. The scope slug tells ops which file
 * on their desktop is which; it is built from validated values, never from
 * a raw parameter. The date is the UTC day, so two exports of the same
 * scope on the same day collide by design.
 */
export function exportFilename(scope: string, date = new Date()): string {
  const slug = scope.replace(/[^a-z0-9]+/gi, "-").toLowerCase() || "all"
  return `payments-${slug}-${date.toISOString().slice(0, 10)}.csv`
}
