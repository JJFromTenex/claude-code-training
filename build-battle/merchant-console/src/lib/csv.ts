import { merchantById } from "@/data/merchants"
import { Payment } from "@/data/types"
import { formatMoney } from "./money"

/**
 * CSV export for the payments table.
 *
 * Ops chooses the columns and the scope (NWP-101). The card last four is
 * excluded unless explicitly requested, because these files get sent to
 * merchants.
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

/** What an export contains when no columns are chosen: everything but last4. */
export const DEFAULT_EXPORT_COLUMNS: readonly ExportColumn[] =
  EXPORT_COLUMNS.filter((column) => column !== "last4")

/**
 * Parse the client's `columns` param against the allowlist. Order is
 * preserved, duplicates are dropped. Absent means the default set; an empty
 * or unknown selection is `null`, and the route rejects it.
 */
export function parseExportColumns(
  param: string | null,
): readonly ExportColumn[] | null {
  if (param === null) return DEFAULT_EXPORT_COLUMNS

  const requested = param
    .split(",")
    .map((column) => column.trim())
    .filter(Boolean)
  if (requested.length === 0) return null

  const columns: ExportColumn[] = []
  for (const column of requested) {
    if (!EXPORT_COLUMNS.includes(column as ExportColumn)) return null
    if (!columns.includes(column as ExportColumn))
      columns.push(column as ExportColumn)
  }
  return columns
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
 * `payments-disputed-2026-08-13.csv`. The label reflects the scope and only
 * ever comes from allowlisted values, never raw client input.
 */
export function exportFilename(date = new Date(), scopeLabel?: string): string {
  const day = date.toISOString().slice(0, 10)
  return scopeLabel
    ? `payments-${scopeLabel}-${day}.csv`
    : `payments-${day}.csv`
}
