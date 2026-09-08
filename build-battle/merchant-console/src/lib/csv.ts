import { merchantById } from "@/data/merchants"
import { Payment } from "@/data/types"
import { formatMoney } from "./money"

/**
 * CSV export for the payments table.
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

// last4 is off by default: merchants get the file more often than not, and
// stripping the card column by hand was the pain that drove NWP-101.
export const DEFAULT_COLUMNS: readonly ExportColumn[] = EXPORT_COLUMNS.filter(
  (column) => column !== "last4",
)

const EXPORT_COLUMN_SET: ReadonlySet<string> = new Set(EXPORT_COLUMNS)

/**
 * Parse a comma-separated column list from the export URL, allowlisted against
 * EXPORT_COLUMNS. Returns null for empty or unknown input so the route can 400
 * rather than let a bad name reach a query, a filename, or the CSV writer.
 */
export function parseColumns(
  raw: string | null,
): readonly ExportColumn[] | null {
  if (raw === null) return null
  const parts = raw
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean)
  if (parts.length === 0) return null
  for (const part of parts) {
    if (!EXPORT_COLUMN_SET.has(part)) return null
  }
  return parts as readonly ExportColumn[]
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

export function exportFilename(
  date: Date = new Date(),
  opts: { status?: string; scope?: "filtered" | "all" } = {},
): string {
  const parts = ["payments"]
  if (opts.scope === "all") parts.push("all")
  else if (opts.status && opts.status !== "all") parts.push(opts.status)
  parts.push(date.toISOString().slice(0, 10))
  return `${parts.join("-")}.csv`
}
