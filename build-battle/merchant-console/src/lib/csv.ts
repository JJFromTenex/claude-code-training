import { merchantById } from "@/data/merchants"
import { Payment } from "@/data/types"
import { formatMoney } from "./money"

/**
 * CSV export for the payments table.
 *
 * Ops chooses the columns and the scope (NWP-101). Column names arrive from
 * the client, so they are checked against EXPORT_COLUMNS before they reach a
 * file — parseExportColumns is that boundary.
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
 * What ships when the client names no columns. The card last four is
 * sensitive by default — a file headed to a merchant should not carry it
 * unless someone deliberately asked for it.
 */
export const DEFAULT_EXPORT_COLUMNS: readonly ExportColumn[] =
  EXPORT_COLUMNS.filter((column) => column !== "last4")

/**
 * The allowlist boundary for column names. Anything the client sends that is
 * not a known column is dropped rather than trusted, and the survivors come
 * back in EXPORT_COLUMNS order so the header is stable between exports.
 *
 * Returns DEFAULT_EXPORT_COLUMNS when the param is absent, and an empty array
 * when the param is present but nothing in it survives — the caller decides
 * what an empty selection means.
 */
export function parseExportColumns(
  param: string | null,
): readonly ExportColumn[] {
  if (param === null) return DEFAULT_EXPORT_COLUMNS

  const requested = new Set(param.split(",").map((name) => name.trim()))
  return EXPORT_COLUMNS.filter((column) => requested.has(column))
}

export type ExportScope = "current" | "all"

/** Whether the client asked for every payment or just the filtered set. */
export function parseExportScope(param: string | null): ExportScope {
  return param === "all" ? "all" : "current"
}

/**
 * The scope half of the filename. An all-payments export says so; a filtered
 * one names its status filter when it has one, and falls back to "current"
 * when the filter is a merchant or a search that no single word describes.
 */
export function exportScopeLabel(
  scope: ExportScope,
  status?: string | null,
): string {
  if (scope === "all") return "all"
  if (status && status !== "all") return status
  return "current"
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

export function exportFilename(scopeLabel: string, date = new Date()): string {
  return `payments-${scopeLabel}-${date.toISOString().slice(0, 10)}.csv`
}
