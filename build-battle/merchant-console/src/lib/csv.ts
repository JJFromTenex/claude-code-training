import { merchantById } from "@/data/merchants"
import { Payment } from "@/data/types"
import { formatMoney } from "./money"

/**
 * CSV export for the payments table.
 *
 * Ops picks the columns and the scope. `EXPORT_COLUMNS` is the allowlist:
 * anything arriving from the client is checked against it here, before it
 * reaches a header row or a filename.
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

/** Card last four is opt-in: most exports go to a merchant. */
export const DEFAULT_EXPORT_COLUMNS: readonly ExportColumn[] =
  EXPORT_COLUMNS.filter((column) => column !== "last4")

export type ExportScope = "filtered" | "all"

function isExportColumn(value: string): value is ExportColumn {
  return (EXPORT_COLUMNS as readonly string[]).includes(value)
}

/**
 * Validate a client-supplied column list against the allowlist.
 *
 * Absent means "give me the default set". Present but empty of anything
 * recognized returns no columns, which callers reject rather than serving
 * a headerless file.
 */
export function parseExportColumns(raw: string | null): ExportColumn[] {
  if (raw === null) return [...DEFAULT_EXPORT_COLUMNS]

  const columns: ExportColumn[] = []
  for (const part of raw.split(",")) {
    const column = part.trim()
    if (isExportColumn(column) && !columns.includes(column)) {
      columns.push(column)
    }
  }
  return columns
}

export function parseExportScope(raw: string | null): ExportScope {
  return raw === "all" ? "all" : "filtered"
}

/** The middle segment of the filename: the status when there is one, else the scope. */
export function exportLabel(scope: ExportScope, status?: string): string {
  if (scope === "all") return "all"
  return status && status !== "all" ? status : "filtered"
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

export function exportFilename(label: string, date = new Date()): string {
  return `payments-${label}-${date.toISOString().slice(0, 10)}.csv`
}
