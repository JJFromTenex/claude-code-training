import { merchantById } from "@/data/merchants"
import { Payment } from "@/data/types"
import { formatMoney } from "./money"

/**
 * CSV export for the payments table.
 *
 * This module owns the column allowlist, the cell rendering, and the filename.
 * Ops picks the columns and the scope; everything here runs on the server, so
 * a chosen column set never narrows the rows the file covers.
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
 * What an export ships when the caller names no columns. Card last four is
 * absent by default because most of these files leave the building: adding it
 * back is one click, whereas stripping it by hand is a spreadsheet edit that
 * someone eventually forgets.
 */
export const DEFAULT_EXPORT_COLUMNS: readonly ExportColumn[] =
  EXPORT_COLUMNS.filter((column) => column !== "last4")

function isExportColumn(value: string): value is ExportColumn {
  return (EXPORT_COLUMNS as readonly string[]).includes(value)
}

/**
 * Turns the client's `columns` parameter into a checked column list.
 *
 * Names are matched against EXPORT_COLUMNS rather than trusted, unknown ones
 * are dropped, and duplicates collapse. The caller's order is preserved, since
 * the file comes out in the order ops picked it. A missing parameter means no
 * choice was made and yields the defaults; a parameter with nothing valid in it
 * yields an empty list, which the route rejects rather than serving a file with
 * a header and nothing beneath it.
 */
export function parseExportColumns(param: string | null): ExportColumn[] {
  if (param === null) return [...DEFAULT_EXPORT_COLUMNS]

  const chosen = new Set<ExportColumn>()
  for (const name of param.split(",")) {
    const trimmed = name.trim()
    if (isExportColumn(trimmed)) chosen.add(trimmed)
  }
  return [...chosen]
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

export function exportFilename(date = new Date(), scope?: string): string {
  const day = date.toISOString().slice(0, 10)
  if (!scope) return `payments-${day}.csv`

  // The scope reaching here is already allowlisted, so this is the second gate
  // rather than the first: it keeps a later caller from putting a path
  // separator or a space into a filename.
  const safe = scope
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
  return safe ? `payments-${safe}-${day}.csv` : `payments-${day}.csv`
}
