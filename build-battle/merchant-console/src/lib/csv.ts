import { merchantById } from "@/data/merchants"
import { Payment } from "@/data/types"
import { formatMoney } from "./money"

/**
 * CSV export for the payments table.
 *
 * Ops chooses the columns and the scope (NWP-101). The card last four is
 * opt-in, because most files leave the building.
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

/** Every column except the card last four, which ops opts into per export. */
export const DEFAULT_EXPORT_COLUMNS: readonly ExportColumn[] =
  EXPORT_COLUMNS.filter((column) => column !== "last4")

export function isExportColumn(value: string): value is ExportColumn {
  return (EXPORT_COLUMNS as readonly string[]).includes(value)
}

/**
 * Column names arrive from the client. Returns null when any name is unknown
 * or the list is empty, so the caller rejects rather than guessing.
 *
 * Repeats are collapsed rather than rejected: asking for a column twice can
 * only mean once. Collapsing also bounds the list at the allowlist's length.
 */
export function parseExportColumns(
  value: string | null,
): ExportColumn[] | null {
  if (value === null) return [...DEFAULT_EXPORT_COLUMNS]

  const requested = value.split(",").filter((name) => name !== "")
  if (requested.length === 0) return null
  if (!requested.every(isExportColumn)) return null

  return [...new Set(requested)] as ExportColumn[]
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

export function exportFilename(date = new Date(), scope?: string): string {
  // The slug reaches a Content-Disposition header, so it is stripped here too
  // even though callers pass allowlisted values.
  const slug = scope?.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")
  const parts = ["payments", slug || undefined, date.toISOString().slice(0, 10)]
  return `${parts.filter(Boolean).join("-")}.csv`
}
