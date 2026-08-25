import { merchantById } from "@/data/merchants"
import { Payment } from "@/data/types"
import { formatMoney } from "./money"

/**
 * CSV export for the payments table.
 *
 * The column set is fixed. Ops has asked for control over it — that is
 * NWP-101 — but today everyone gets every column, including the card
 * last four, whether or not the file is going to a merchant.
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

export const EXPORT_COLUMN_LABELS: Record<ExportColumn, string> = {
  id: "Payment ID",
  created_at: "Created at",
  merchant: "Merchant",
  description: "Description",
  status: "Status",
  method: "Method",
  card_brand: "Card brand",
  last4: "Card last four",
  amount: "Amount",
  currency: "Currency",
}

/**
 * Column names arrive from the client, so they are checked against the
 * `EXPORT_COLUMNS` allowlist before they reach `toCsv` or a filename. Unknown
 * columns are dropped rather than rejected outright; an empty result after
 * filtering is the caller's problem to reject.
 *
 * No `columns` param at all (`null`) means an older link with no opinion on
 * columns, so it gets every column. An explicitly empty selection (`""`)
 * means the caller deselected everything, so it gets none.
 */
export function parseExportColumns(param: string | null): ExportColumn[] {
  if (param === null) return [...EXPORT_COLUMNS]
  if (param === "") return []
  const requested = param.split(",").map((c) => c.trim())
  return requested.filter((c): c is ExportColumn =>
    (EXPORT_COLUMNS as readonly string[]).includes(c),
  )
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

/** Scope label stamped into the filename: "all", a specific status, or "filtered". */
export function exportFilename(scope: string, date = new Date()): string {
  return `payments-${scope}-${date.toISOString().slice(0, 10)}.csv`
}
