import { merchantById } from "@/data/merchants"
import { Payment } from "@/data/types"
import { formatMoney } from "./money"

/**
 * CSV export for the payments table.
 *
 * Ops picks the columns. The card last four is off by default, because most
 * files go to a merchant and used to be cleaned up by hand first. The picked
 * set arrives from the client, so it is matched against EXPORT_COLUMNS before
 * it reaches a serializer or a filename — see parseExportColumns.
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
 * What ops gets when they do not say otherwise: everything except the card
 * last four. Derived from EXPORT_COLUMNS so a new column cannot be added to
 * one list and forgotten in the other.
 */
export const DEFAULT_EXPORT_COLUMNS: readonly ExportColumn[] =
  EXPORT_COLUMNS.filter((column) => column !== "last4")

/**
 * Column names arrive from the client. Match them against the allowlist —
 * never interpolate one into a query or a filename.
 *
 * Unknown names are dropped, duplicates collapse, and the order the caller
 * asked for is what comes back. An empty result means the request selected
 * nothing valid; the route turns that into a 400 rather than an empty file.
 */
export function parseExportColumns(raw: string | null): ExportColumn[] {
  if (!raw) return []

  const allowed = new Set<string>(EXPORT_COLUMNS)
  const picked: ExportColumn[] = []

  for (const name of raw.split(",")) {
    const column = name.trim()
    if (!allowed.has(column)) continue
    if (picked.includes(column as ExportColumn)) continue
    picked.push(column as ExportColumn)
  }

  return picked
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
 * Names the file after what is in it. `scope` is the status the export was
 * filtered to, or "all" when it ignores the filters — omitted when the export
 * covers every status under the current filter, which is the plain
 * `payments-<date>.csv` ops already knows.
 */
export function exportFilename(date = new Date(), scope?: string): string {
  const stamp = date.toISOString().slice(0, 10)
  return `payments-${scope ? `${scope}-` : ""}${stamp}.csv`
}
