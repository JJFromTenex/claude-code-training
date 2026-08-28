import { merchantById } from "@/data/merchants"
import { Payment, PaymentFilters } from "@/data/types"
import { formatMoney } from "./money"

/**
 * CSV export for the payments table.
 *
 * Ops chooses the columns and the scope (NWP-101). Both arrive from the
 * client as query params, so they are parsed here against an allowlist
 * before they reach the serializer or the filename. The card last four is
 * off unless it is asked for, because most files go to a merchant.
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

/** What ops gets without choosing: everything except the card last four. */
export const DEFAULT_EXPORT_COLUMNS: readonly ExportColumn[] =
  EXPORT_COLUMNS.filter((column) => column !== "last4")

export type ExportScope = "current" | "all"

function isExportColumn(value: string): value is ExportColumn {
  return (EXPORT_COLUMNS as readonly string[]).includes(value)
}

/**
 * Parse the `columns` query param. Absent means the default set; present
 * means exactly the valid names it lists, in the order it lists them.
 * Unknown names and repeats are dropped, so an empty result means the
 * client asked for nothing usable and the route should refuse.
 */
export function parseExportColumns(raw: string | null): ExportColumn[] {
  if (raw === null) return [...DEFAULT_EXPORT_COLUMNS]
  const columns: ExportColumn[] = []
  for (const part of raw.split(",")) {
    const name = part.trim()
    if (isExportColumn(name) && !columns.includes(name)) columns.push(name)
  }
  return columns
}

/** Parse the `scope` query param. Anything but an explicit "all" is the current filter. */
export function parseExportScope(raw: string | null): ExportScope {
  return raw === "all" ? "all" : "current"
}

/**
 * The word that goes in the filename. Every value here is a literal or a
 * status that `parseFilters` already allowlisted; nothing from the client
 * reaches the filename directly.
 */
export function exportScopeLabel(
  scope: ExportScope,
  filters: PaymentFilters,
): string | undefined {
  if (scope === "all") return "all"
  if (filters.status && filters.status !== "all") return filters.status
  if (filters.merchantId || filters.search || filters.from || filters.to) {
    return "filtered"
  }
  return undefined
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

export function exportFilename(date = new Date(), label?: string): string {
  const scope = label ? `${label}-` : ""
  return `payments-${scope}${date.toISOString().slice(0, 10)}.csv`
}
