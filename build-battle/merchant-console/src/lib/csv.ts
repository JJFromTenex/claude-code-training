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

/**
 * The columns ops gets by default. Card last four is off: most exports go to a
 * merchant, and an unmasked last four in one of those is the near-miss NWP-101
 * is here to prevent. Ops opts back in per export.
 */
export const DEFAULT_EXPORT_COLUMNS = EXPORT_COLUMNS.filter(
  (column) => column !== "last4",
)

/**
 * Turn a client-supplied `columns` value into a validated column list.
 *
 * Column names arrive from the client, so they are checked against
 * EXPORT_COLUMNS before they reach the serializer or the filename. Unknown
 * names are dropped, duplicates collapse, and the caller's order is kept so the
 * file matches what ops asked for. An empty or all-invalid input yields [].
 */
export function parseColumns(param: string | null): ExportColumn[] {
  if (!param) return []
  const allowed = new Set<string>(EXPORT_COLUMNS)
  const seen = new Set<ExportColumn>()
  const columns: ExportColumn[] = []
  for (const raw of param.split(",")) {
    const name = raw.trim()
    if (allowed.has(name) && !seen.has(name as ExportColumn)) {
      seen.add(name as ExportColumn)
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
 * Download filename. The optional slug reflects the export scope so ops can
 * tell files apart on disk, for example `payments-disputed-2026-08-13.csv`.
 * The date is the UTC day, matching how the rest of the app buckets.
 */
export function exportFilename(date = new Date(), slug?: string): string {
  const day = date.toISOString().slice(0, 10)
  return slug ? `payments-${slug}-${day}.csv` : `payments-${day}.csv`
}
