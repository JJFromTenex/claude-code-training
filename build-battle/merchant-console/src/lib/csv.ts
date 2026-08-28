import { merchantById } from "@/data/merchants"
import { Payment } from "@/data/types"
import { formatMoney } from "./money"

/**
 * CSV export for the payments table. Ops chooses the column set (NWP-101);
 * card last four is excluded unless explicitly requested.
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

export const DEFAULT_EXPORT_COLUMNS: readonly ExportColumn[] = EXPORT_COLUMNS.filter(
  (column) => column !== "last4",
)

/**
 * Column names arrive from the client as a comma-separated list. Validate
 * against the allowlist and keep the order requested; anything unknown is
 * dropped rather than trusted. `null` (param not given at all) falls back to
 * the safe default; an empty or all-invalid list comes back empty so the
 * route can reject it rather than silently exporting every column.
 */
export function parseExportColumns(
  param: string | null,
): readonly ExportColumn[] {
  if (param === null) return DEFAULT_EXPORT_COLUMNS

  const seen = new Set<ExportColumn>()
  for (const value of param.split(",").map((v) => v.trim())) {
    if ((EXPORT_COLUMNS as readonly string[]).includes(value)) {
      seen.add(value as ExportColumn)
    }
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

export function exportFilename(label: string, date = new Date()): string {
  return `payments-${label}-${date.toISOString().slice(0, 10)}.csv`
}
