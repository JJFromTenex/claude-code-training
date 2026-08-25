import { merchantById } from "@/data/merchants"
import { Payment } from "@/data/types"
import { formatMoney } from "./money"

/**
 * CSV export for the payments table.
 *
 * Ops chooses the column set (NWP-101). Column names arrive from the client,
 * so EXPORT_COLUMNS is the allowlist they are checked against before any of
 * them reaches a file. The card last four is off by default, so a file bound
 * for a merchant is clean unless somebody asks for it.
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

/** Every column except the card last four, which ops opts into. */
export const DEFAULT_EXPORT_COLUMNS: readonly ExportColumn[] =
  EXPORT_COLUMNS.filter((column) => column !== "last4")

function isExportColumn(value: string): value is ExportColumn {
  return (EXPORT_COLUMNS as readonly string[]).includes(value)
}

/**
 * Validate a client-supplied column list against the allowlist.
 *
 * An absent parameter means the caller expressed no preference and gets the
 * defaults. A present one is filtered: unknown names are dropped rather than
 * echoed, duplicates collapse, and the requested order is kept. An empty
 * result is returned as such — refusing it is the route's job, because only
 * the route can say so with a status code.
 */
export function parseExportColumns(param: string | null): ExportColumn[] {
  if (param === null) return [...DEFAULT_EXPORT_COLUMNS]

  const chosen = new Set<ExportColumn>()
  for (const raw of param.split(",")) {
    const candidate = raw.trim()
    if (isExportColumn(candidate)) chosen.add(candidate)
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

/**
 * Names the file after what is in it. The scope segment is derived from
 * validated filters by the caller, never from a raw parameter — a filename
 * is one of the places client input is not allowed to land unchecked.
 */
export function exportFilename(date = new Date(), scope?: string): string {
  const stamp = date.toISOString().slice(0, 10)
  return scope ? `payments-${scope}-${stamp}.csv` : `payments-${stamp}.csv`
}
