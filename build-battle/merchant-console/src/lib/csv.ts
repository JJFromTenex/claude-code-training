import { merchantById } from "@/data/merchants"
import { Payment } from "@/data/types"
import { formatMoney } from "./money"

/**
 * CSV export for the payments table.
 *
 * NWP-101: ops chooses which columns are included and whether the export
 * covers the current filter or every payment. Card last four is excluded
 * by default, since files often go straight to a merchant.
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

/** Every export column except the card last four, which is opt-in. */
export const DEFAULT_EXPORT_COLUMNS: readonly ExportColumn[] =
  EXPORT_COLUMNS.filter((column) => column !== "last4")

/**
 * Parses the `columns` query param into an ordered, validated column list.
 *
 * `raw` is untrusted client input: split on comma, trim, drop anything not
 * in `EXPORT_COLUMNS`, and dedupe while preserving the first occurrence and
 * the order the client asked for. A missing param falls back to
 * `DEFAULT_EXPORT_COLUMNS`; an empty or fully-invalid selection returns an
 * empty list so the caller can reject it.
 */
export function parseExportColumns(raw: string | null): ExportColumn[] {
  if (raw === null) return [...DEFAULT_EXPORT_COLUMNS]

  const seen = new Set<ExportColumn>()
  const columns: ExportColumn[] = []
  for (const name of raw.split(",").map((part) => part.trim())) {
    if (!name) continue
    if (!(EXPORT_COLUMNS as readonly string[]).includes(name)) continue
    const column = name as ExportColumn
    if (seen.has(column)) continue
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

export function exportFilename(scope: string, date = new Date()): string {
  return `payments-${scope}-${date.toISOString().slice(0, 10)}.csv`
}
