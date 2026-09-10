import { merchantById } from "@/data/merchants"
import { Payment } from "@/data/types"
import { formatMoney } from "./money"

/**
 * CSV export for the payments table.
 *
 * Ops picks the columns (NWP-101). Column names arrive from the client, so
 * they are checked against EXPORT_COLUMNS before they reach the serializer.
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

/** What the dialog starts with: everything except the card last four. */
export const DEFAULT_EXPORT_COLUMNS: readonly ExportColumn[] =
  EXPORT_COLUMNS.filter((column) => column !== "last4")

export type ExportOptionResult<T> =
  | { ok: true; columns: T }
  | { ok: false; message: string }

/**
 * Parse the `columns` query value. `null` (param absent) means the default
 * set; anything present must be a comma-separated list of allowlisted names
 * with no repeats. Rejections carry a message safe to show a user.
 */
export function parseExportColumns(
  raw: string | null,
): ExportOptionResult<readonly ExportColumn[]> {
  if (raw === null) return { ok: true, columns: DEFAULT_EXPORT_COLUMNS }
  if (raw === "") return { ok: false, message: "Select at least one column" }

  const columns: ExportColumn[] = []
  for (const name of raw.split(",")) {
    if (!EXPORT_COLUMNS.includes(name as ExportColumn)) {
      return { ok: false, message: `Unknown column "${name}"` }
    }
    if (columns.includes(name as ExportColumn)) {
      return { ok: false, message: `Duplicate column "${name}"` }
    }
    columns.push(name as ExportColumn)
  }
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

export function exportFilename(date = new Date()): string {
  return `payments-${date.toISOString().slice(0, 10)}.csv`
}
