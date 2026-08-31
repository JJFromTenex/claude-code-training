import { merchantById } from "@/data/merchants"
import { Payment } from "@/data/types"
import { formatMoney } from "./money"

/**
 * CSV export for the payments table.
 *
 * `EXPORT_COLUMNS` is the allowlist: a column name that is not in it never
 * reaches a header, a cell, or a filename. `DEFAULT_EXPORT_COLUMNS` is what
 * ops gets when they express no preference, and it omits the card last four
 * so a file bound for a merchant is safe by default rather than by editing.
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

/** Every column except the card last four. Opt in to that one deliberately. */
export const DEFAULT_EXPORT_COLUMNS: readonly ExportColumn[] =
  EXPORT_COLUMNS.filter((column) => column !== "last4")

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

/**
 * Check a client-supplied column list against the allowlist.
 *
 * Order is the operator's, not ours — the file comes out in the order they
 * asked for. Absent means "no preference", so they get the default set.
 * Naming columns and having none of them survive is a mistake worth telling
 * them about, so that is `null` rather than a silent fallback.
 */
export function parseExportColumns(
  param: string | null,
): ExportColumn[] | null {
  if (param === null) return [...DEFAULT_EXPORT_COLUMNS]

  const seen = new Set<ExportColumn>()
  for (const name of param.split(",")) {
    const trimmed = name.trim()
    if (EXPORT_COLUMNS.includes(trimmed as ExportColumn)) {
      seen.add(trimmed as ExportColumn)
    }
  }

  return seen.size > 0 ? [...seen] : null
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
 * Name the file after what is in it. The scope slug is derived from filters
 * that have already been through `parseFilters`, never from raw client text.
 */
export function exportFilename(date = new Date(), scope?: string): string {
  const stamp = date.toISOString().slice(0, 10)
  return scope ? `payments-${scope}-${stamp}.csv` : `payments-${stamp}.csv`
}
