import { merchantById } from "@/data/merchants"
import { Payment } from "@/data/types"
import { utcDayKey } from "./dates"
import { formatMoney } from "./money"

/**
 * CSV export for the payments table.
 *
 * This module owns the export contract: which columns exist, which of them
 * ship by default, and how a client's request for a subset is validated. Ops
 * chooses the columns and the scope (NWP-101); the card last four is off
 * unless someone asks for it, because most of these files go to a merchant.
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

/** Everything but the card last four. What you get when nobody chooses. */
export const DEFAULT_EXPORT_COLUMNS: readonly ExportColumn[] =
  EXPORT_COLUMNS.filter((column) => column !== "last4")

export const EXPORT_SCOPES = ["filtered", "all"] as const

export type ExportScope = (typeof EXPORT_SCOPES)[number]

function isExportColumn(value: string): value is ExportColumn {
  return (EXPORT_COLUMNS as readonly string[]).includes(value)
}

/**
 * Turns a client's `columns` parameter into columns we know exist.
 *
 * Names arrive from the browser, so they are checked against EXPORT_COLUMNS
 * rather than trusted: anything unrecognised is dropped, never passed along.
 * The order asked for is the order written, so ops can arrange the file.
 *
 * An absent parameter means "no preference" and gets the default set. An empty
 * one means the user cleared every box, which returns an empty list for the
 * caller to refuse — writing a header with no columns is not a useful file.
 */
export function parseExportColumns(
  raw: string | null | undefined,
): ExportColumn[] {
  if (raw == null) return [...DEFAULT_EXPORT_COLUMNS]

  const chosen: ExportColumn[] = []
  for (const name of raw.split(",")) {
    const column = name.trim()
    if (!isExportColumn(column)) continue
    if (chosen.includes(column)) continue
    chosen.push(column)
  }
  return chosen
}

/** Current filter, or every payment. Anything else is treated as the default. */
export function parseExportScope(raw: string | null | undefined): ExportScope {
  return raw === "all" ? "all" : "filtered"
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
 * Names the file after what is in it: the scope and the UTC day.
 *
 * The scope slug is not client text. Callers pass either the literal "all" or
 * a status that has already been through the filter allowlist, so nothing
 * typed into a URL reaches a content-disposition header.
 */
export function exportFilename(date = new Date(), scope?: string): string {
  const day = utcDayKey(date.toISOString())
  return `payments-${scope ? `${scope}-` : ""}${day}.csv`
}
