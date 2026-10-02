import { merchantById } from "@/data/merchants"
import { Payment } from "@/data/types"
import { formatMoney } from "./money"

/**
 * CSV export for the payments table.
 *
 * Ops chooses the columns and the scope (NWP-101). Column names arrive from
 * the client, so the route passes them through parseExportColumns, which
 * checks each one against EXPORT_COLUMNS. The card last four is off unless
 * someone asks for it, because most of these files go to merchants.
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

/** What ships when the client does not say: everything but the last four. */
export const DEFAULT_EXPORT_COLUMNS: readonly ExportColumn[] =
  EXPORT_COLUMNS.filter((column) => column !== "last4")

export const EXPORT_SCOPES = ["filter", "all"] as const

export type ExportScope = (typeof EXPORT_SCOPES)[number]

type Parsed<T> = { ok: true; value: T } | { ok: false; message: string }

/**
 * Parse the comma-separated `columns` param against the allowlist.
 * Absent means the defaults; present but empty is an error, not an empty file.
 * Duplicates are dropped and the requested order is kept.
 */
export function parseExportColumns(
  param: string | null,
): Parsed<ExportColumn[]> {
  if (param === null) return { ok: true, value: [...DEFAULT_EXPORT_COLUMNS] }

  const names = param
    .split(",")
    .map((name) => name.trim())
    .filter(Boolean)
  if (names.length === 0) {
    return { ok: false, message: "Choose at least one column to export." }
  }

  const columns: ExportColumn[] = []
  for (const name of names) {
    if (!EXPORT_COLUMNS.includes(name as ExportColumn)) {
      return { ok: false, message: `Unknown export column: ${name}` }
    }
    if (!columns.includes(name as ExportColumn)) columns.push(name as ExportColumn)
  }
  return { ok: true, value: columns }
}

/** Parse the `scope` param. Absent means the current filter. */
export function parseExportScope(param: string | null): Parsed<ExportScope> {
  if (param === null) return { ok: true, value: "filter" }
  if (EXPORT_SCOPES.includes(param as ExportScope)) {
    return { ok: true, value: param as ExportScope }
  }
  return { ok: false, message: `Unknown export scope: ${param}` }
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
  if (columns.length === 0) {
    throw new RangeError("toCsv needs at least one column")
  }
  const header = columns.join(",")
  const rows = payments.map((payment) =>
    columns.map((column) => escapeCell(cell(payment, column))).join(","),
  )
  return [header, ...rows].join("\n")
}

/**
 * `payments-disputed-2026-08-13.csv`. The label must already be built from
 * validated values; free text from the client never belongs in a filename.
 */
export function exportFilename(date = new Date(), label?: string): string {
  const day = date.toISOString().slice(0, 10)
  return label ? `payments-${label}-${day}.csv` : `payments-${day}.csv`
}
