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

/** Card last-four is off by default; ops opts in explicitly. */
export const DEFAULT_EXPORT_COLUMNS = EXPORT_COLUMNS.filter(
  (column) => column !== "last4",
)

/**
 * Resolves the columns to export from client-supplied names.
 *
 * `undefined` (no preference expressed) falls back to the default set.
 * An explicit empty array is a deliberate "deselect everything" and stays
 * empty — the caller decides what to do with that, this just doesn't paper
 * over it. Anything not in EXPORT_COLUMNS is dropped; order and duplicates
 * from the input are otherwise preserved.
 */
export function parseExportColumns(
  raw: readonly string[] | null | undefined,
): ExportColumn[] {
  if (raw == null) return [...DEFAULT_EXPORT_COLUMNS]
  const seen = new Set<ExportColumn>()
  for (const value of raw) {
    if ((EXPORT_COLUMNS as readonly string[]).includes(value)) {
      seen.add(value as ExportColumn)
    }
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
 * `scope` names what the file contains beyond "payments": a status like
 * "disputed" for a filtered export, or "all" for the unfiltered one.
 * Omitted, the name is just the date, as it was before scope existed.
 */
export function exportFilename(date = new Date(), scope?: string): string {
  const suffix = scope ? `-${scope}` : ""
  return `payments${suffix}-${date.toISOString().slice(0, 10)}.csv`
}
