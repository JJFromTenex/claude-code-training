import { merchantById } from "@/data/merchants"
import { Payment } from "@/data/types"
import { formatMinorUnitsPlain } from "./money"

/**
 * CSV export for the payments table.
 *
 * Ops chooses the columns (NWP-101). EXPORT_COLUMNS is the allowlist every
 * requested name is checked against; DEFAULT_EXPORT_COLUMNS is what ships when
 * nobody asks for anything in particular, and it leaves the card last four out
 * because most of these files go to a merchant.
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

/** The default file. Card last four is opt-in, never automatic. */
export const DEFAULT_EXPORT_COLUMNS: readonly ExportColumn[] =
  EXPORT_COLUMNS.filter((column) => column !== "last4")

function isExportColumn(value: string): value is ExportColumn {
  return (EXPORT_COLUMNS as readonly string[]).includes(value)
}

/**
 * Column names arrive from the client, so they are checked against
 * EXPORT_COLUMNS before they reach a file. Unknown names are dropped, the
 * caller's order is kept, and duplicates collapse. An empty result means
 * nothing valid was asked for; the caller decides what to do about that.
 */
export function parseExportColumns(raw: string | null): ExportColumn[] {
  if (!raw) return []

  const seen = new Set<string>()
  const columns: ExportColumn[] = []

  for (const name of raw.split(",")) {
    const column = name.trim()
    if (!isExportColumn(column) || seen.has(column)) continue
    seen.add(column)
    columns.push(column)
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
      // The one place minor units become a decimal. No symbol: the currency
      // column carries the code, so the number stays a number.
      return formatMinorUnitsPlain(payment.amount)
    case "currency":
      return payment.currency
  }
}

export function toCsv(
  payments: Payment[],
  columns: readonly ExportColumn[] = DEFAULT_EXPORT_COLUMNS,
): string {
  const header = columns.join(",")
  const rows = payments.map((payment) =>
    columns.map((column) => escapeCell(cell(payment, column))).join(","),
  )
  return [header, ...rows].join("\n")
}

/**
 * `payments-<scope>-<date>.csv`, so the name says which file this is rather
 * than only when it was taken. The scope reaches here from the client, so it
 * is stripped to the characters a filename may hold. Two exports of the same
 * scope on the same UTC day still collide, by design.
 */
export function exportFilename(scope: string | null, date = new Date()): string {
  const slug = (scope ?? "").replace(/[^a-z0-9-]/gi, "").toLowerCase()
  const segment = slug ? `${slug}-` : ""
  return `payments-${segment}${date.toISOString().slice(0, 10)}.csv`
}
