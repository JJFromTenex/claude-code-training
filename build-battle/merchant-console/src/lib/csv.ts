import { merchantById } from "@/data/merchants"
import { Payment } from "@/data/types"
import { formatMoney } from "./money"

/**
 * CSV export for the payments table.
 *
 * Callers pick the column set (NWP-101). Card metadata is off by default
 * so a file bound for a merchant never carries the last four unless ops
 * opts in.
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

export const DEFAULT_EXPORT_COLUMNS: readonly ExportColumn[] =
  EXPORT_COLUMNS.filter((c) => c !== "last4" && c !== "card_brand")

/**
 * Allowlist gate for client-supplied column names. Absent means the
 * defaults; an empty or unknown selection is rejected outright rather
 * than silently dropped.
 */
export function parseExportColumns(raw: string | null): ExportColumn[] | null {
  if (raw === null) return [...DEFAULT_EXPORT_COLUMNS]
  const requested = raw
    .split(",")
    .map((c) => c.trim())
    .filter(Boolean)
  if (requested.length === 0) return null
  const columns: ExportColumn[] = []
  for (const c of requested) {
    if (!EXPORT_COLUMNS.includes(c as ExportColumn)) return null
    if (!columns.includes(c as ExportColumn)) columns.push(c as ExportColumn)
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

/** The slug must come from an allowlisted value, never raw client input. */
export function exportFilename(date = new Date(), slug?: string): string {
  const middle = slug ? `${slug}-` : ""
  return `payments-${middle}${date.toISOString().slice(0, 10)}.csv`
}
