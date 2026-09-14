import { merchantById } from "@/data/merchants"
import { Payment } from "@/data/types"
import { formatMoney } from "./money"

/**
 * CSV export for the payments table.
 *
 * EXPORT_COLUMNS is the full catalogue. DEFAULT_EXPORT_COLUMNS is what a file
 * ships when nobody says otherwise, and it leaves the card last four out —
 * most exports go to a merchant, and that column was being stripped by hand.
 *
 * Column names arrive from the client, so they are checked against the
 * catalogue here before they reach a serializer or a filename.
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

/** What an export ships when the client names no columns. Card last four is opt-in. */
export const DEFAULT_EXPORT_COLUMNS: readonly ExportColumn[] =
  EXPORT_COLUMNS.filter((column) => column !== "last4")

export type ExportScope = "filtered" | "all"

function isExportColumn(value: string): value is ExportColumn {
  return (EXPORT_COLUMNS as readonly string[]).includes(value)
}

/**
 * Validate a client-supplied `columns` parameter against the catalogue.
 *
 * Returns the columns in the order requested, `[]` when the client asked for
 * none, or `null` when a name is unknown or repeated. Callers turn the last
 * two into a 400; an unrecognised name never reaches a query or a filename.
 */
export function parseExportColumns(
  param: string | null,
): ExportColumn[] | null {
  if (param === null) return [...DEFAULT_EXPORT_COLUMNS]

  const requested = param
    .split(",")
    .map((name) => name.trim())
    .filter(Boolean)

  const columns: ExportColumn[] = []
  for (const name of requested) {
    if (!isExportColumn(name) || columns.includes(name)) return null
    columns.push(name)
  }
  return columns
}

/** Scope is the current filter unless the client explicitly asks for everything. */
export function parseExportScope(param: string | null): ExportScope {
  return param === "all" ? "all" : "filtered"
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
 * `payments-disputed-2026-08-13.csv`. The label names the scope — "all", or
 * the status being filtered on — and only ever comes from a validated value.
 */
export function exportFilename(date = new Date(), scopeLabel?: string): string {
  const stamp = date.toISOString().slice(0, 10)
  return scopeLabel
    ? `payments-${scopeLabel}-${stamp}.csv`
    : `payments-${stamp}.csv`
}
