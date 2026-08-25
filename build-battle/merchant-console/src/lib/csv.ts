import { merchantById } from "@/data/merchants"
import { Payment } from "@/data/types"
import { formatMoney } from "./money"

/**
 * CSV export for the payments table.
 *
 * Ops chooses the columns and the scope in the export dialog (NWP-101).
 * Column names arrive from the client, so parseExportOptions is the
 * allowlist boundary: nothing outside EXPORT_COLUMNS reaches a cell or
 * a filename.
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
 * What the dialog opens with: every column except the card last-four.
 * Files go to merchants, so last4 is opt-in, never opt-out.
 */
export const DEFAULT_EXPORT_COLUMNS: readonly ExportColumn[] =
  EXPORT_COLUMNS.filter((column) => column !== "last4")

export type ExportScope = "filtered" | "all"

export interface ExportOptions {
  columns: ExportColumn[] | null
  scope: ExportScope
}

/**
 * Allowlist boundary for export params. Unknown column names are dropped,
 * duplicates collapse, and the requested order is kept. `columns: null`
 * means nothing valid survived — the route answers that with a 400 rather
 * than an empty file. Absent `columns` means the default set.
 */
export function parseExportOptions(params: URLSearchParams): ExportOptions {
  const scope: ExportScope = params.get("scope") === "all" ? "all" : "filtered"

  const raw = params.get("columns")
  if (raw === null) return { columns: [...DEFAULT_EXPORT_COLUMNS], scope }

  const columns = [...new Set(raw.split(","))].filter(
    (name): name is ExportColumn =>
      (EXPORT_COLUMNS as readonly string[]).includes(name),
  )
  return { columns: columns.length > 0 ? columns : null, scope }
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

export function exportFilename(date = new Date(), descriptor?: string): string {
  const day = date.toISOString().slice(0, 10)
  return descriptor ? `payments-${descriptor}-${day}.csv` : `payments-${day}.csv`
}
