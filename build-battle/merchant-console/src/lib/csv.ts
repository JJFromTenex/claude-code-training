import { merchantById } from "@/data/merchants"
import { Payment } from "@/data/types"
import { formatMoney } from "./money"

/**
 * CSV export for the payments table.
 *
 * EXPORT_COLUMNS is both the full column set and the allowlist: a name that is
 * not in it never reaches a file or a filename. Ops chooses the subset
 * (NWP-101), and the card last four is opt-in rather than always present.
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
 * What an export contains when nobody has chosen. Everything except the card
 * last four — the one column that forces ops to hand-edit a file before it can
 * go to a merchant.
 */
export const DEFAULT_EXPORT_COLUMNS: readonly ExportColumn[] =
  EXPORT_COLUMNS.filter((column) => column !== "last4")

function isExportColumn(value: string): value is ExportColumn {
  return (EXPORT_COLUMNS as readonly string[]).includes(value)
}

/**
 * Check a client-supplied column list against the allowlist.
 *
 * Order is the caller's: ops asked for columns in the order they pick them.
 * Duplicates collapse to their first position. Returns null when the list is
 * unusable — empty, or naming a column that does not exist — so the caller
 * rejects the request rather than quietly exporting something else.
 */
export function parseExportColumns(
  raw: string | null,
): readonly ExportColumn[] | null {
  if (raw === null) return DEFAULT_EXPORT_COLUMNS

  const requested = raw
    .split(",")
    .map((name) => name.trim())
    .filter((name) => name.length > 0)

  const columns: ExportColumn[] = []
  for (const name of requested) {
    if (!isExportColumn(name)) return null
    if (!columns.includes(name)) columns.push(name)
  }

  return columns.length > 0 ? columns : null
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
 * `payments-disputed-2026-08-13.csv`, or `payments-2026-08-13.csv` when the
 * export is not scoped. The segment is slugged rather than trusted: it derives
 * from client input, and this is a filename.
 */
export function exportFilename(date = new Date(), scope?: string): string {
  const stamp = date.toISOString().slice(0, 10)
  const slug = scope
    ?.toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
  return slug ? `payments-${slug}-${stamp}.csv` : `payments-${stamp}.csv`
}
