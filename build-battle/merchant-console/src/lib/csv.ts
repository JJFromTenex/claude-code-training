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

/** Every column except card last-four — the safe default for a file that might reach a merchant. */
export const DEFAULT_EXPORT_COLUMNS: readonly ExportColumn[] = EXPORT_COLUMNS.filter(
  (column) => column !== "last4",
)

/**
 * Validates a client-supplied column list against the allowlist.
 *
 * No `columns` param at all means the caller didn't ask, so it gets the safe
 * default. A `columns` param that resolves to nothing valid means the caller
 * asked for zero columns, and that is returned as an empty array rather than
 * silently falling back — the route rejects that case instead of shipping an
 * empty file.
 */
export function parseColumns(raw: string | null): ExportColumn[] {
  if (raw === null) return [...DEFAULT_EXPORT_COLUMNS]

  const allowed = new Set(EXPORT_COLUMNS)
  const seen = new Set<ExportColumn>()
  const columns: ExportColumn[] = []

  for (const token of raw.split(",")) {
    if (allowed.has(token as ExportColumn) && !seen.has(token as ExportColumn)) {
      seen.add(token as ExportColumn)
      columns.push(token as ExportColumn)
    }
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

export function exportFilename(date = new Date(), descriptor?: string): string {
  const stamp = date.toISOString().slice(0, 10)
  return descriptor ? `payments-${descriptor}-${stamp}.csv` : `payments-${stamp}.csv`
}
