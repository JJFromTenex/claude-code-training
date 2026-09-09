import { merchantById } from "@/data/merchants"
import { Payment } from "@/data/types"
import { formatMoney } from "./money"

/**
 * CSV export for the payments table.
 *
 * Ops chooses the column set per export (NWP-101). EXPORT_COLUMNS is the
 * allowlist of everything that may appear; DEFAULT_EXPORT_COLUMNS is what
 * ships when nothing is chosen — the card last four is off by default, so
 * a file bound for a merchant is safe without hand-editing.
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

/** Every column except the card last four. */
export const DEFAULT_EXPORT_COLUMNS: readonly ExportColumn[] =
  EXPORT_COLUMNS.filter((column) => column !== "last4")

/**
 * Validate a client-supplied `columns` param against the allowlist.
 *
 * Missing param → the default set. Anything else is taken literally: an
 * unknown name, a duplicate-free empty list, or an empty string is `null`,
 * which the route turns into a 400. Column names are never interpolated
 * into a query or a filename — this list is the only thing that reaches
 * the serializer.
 */
export function parseExportColumns(
  value: string | null,
): readonly ExportColumn[] | null {
  if (value === null) return DEFAULT_EXPORT_COLUMNS
  const names = value.split(",").map((name) => name.trim())
  if (names.some((name) => name === "")) return null
  const columns: ExportColumn[] = []
  for (const name of names) {
    if (!EXPORT_COLUMNS.includes(name as ExportColumn)) return null
    if (!columns.includes(name as ExportColumn)) {
      columns.push(name as ExportColumn)
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

/**
 * `payments-{scope}-{date}.csv`, e.g. `payments-disputed-2026-08-13.csv`.
 * The scope token is built from allowlisted values only; nothing
 * client-supplied lands in the filename verbatim.
 */
export function exportFilename(scope: string, date = new Date()): string {
  return `payments-${scope}-${date.toISOString().slice(0, 10)}.csv`
}
