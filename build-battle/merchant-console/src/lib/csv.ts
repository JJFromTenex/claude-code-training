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

/** What ops gets when they haven't chosen columns explicitly. Card last four
 * is opt-in, not opt-out — see NWP-101. */
export const DEFAULT_EXPORT_COLUMNS: ExportColumn[] = EXPORT_COLUMNS.filter(
  (column) => column !== "last4",
)

function isExportColumn(value: string): value is ExportColumn {
  return (EXPORT_COLUMNS as readonly string[]).includes(value)
}

/**
 * Column names arrive from the client — validate against the allowlist
 * before they reach toCsv or a filename, never interpolate them anywhere.
 *
 * `null` (the param was absent) means "ops didn't choose" → the default
 * set. An explicit `[]` means ops deselected every column and stays `[]` —
 * the route decides what to do with that (reject the request), and the
 * dialog decides what to do with that (disable Download). Order is
 * preserved and unknown/duplicate values are dropped silently.
 */
export function parseExportColumns(requested: string[] | null): ExportColumn[] {
  if (requested === null) return DEFAULT_EXPORT_COLUMNS
  const seen = new Set<ExportColumn>()
  for (const value of requested) {
    if (isExportColumn(value)) seen.add(value)
  }
  return [...seen]
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
 * `scopeLabel` names what's in the file — a status like "disputed", "all"
 * for the all-payments scope, or "filtered" as a fallback — so
 * `payments-disputed-2026-08-13.csv` says what it is before it's opened.
 * The route decides the label; this just stamps it next to the UTC date.
 */
export function exportFilename(scopeLabel: string, date = new Date()): string {
  return `payments-${scopeLabel}-${date.toISOString().slice(0, 10)}.csv`
}
