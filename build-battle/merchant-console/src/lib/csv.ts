import { merchantById } from "@/data/merchants"
import { Payment, PaymentStatus } from "@/data/types"
import { formatMoney } from "./money"

/**
 * CSV export for the payments table.
 *
 * Ops picks the columns and the scope (NWP-101); the route validates both
 * against the allowlists here before a name reaches a header or a filename.
 * The card last four is opt-in — it is absent from DEFAULT_EXPORT_COLUMNS.
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
 * The columns an export includes when ops has not chosen. Everything except
 * the card last four, which merchants must not receive by default.
 */
export const DEFAULT_EXPORT_COLUMNS: readonly ExportColumn[] =
  EXPORT_COLUMNS.filter((column) => column !== "last4")

/**
 * Column names arrive from the client. Keep only the ones on the allowlist,
 * in the order asked for, with duplicates collapsed. Never throws, never
 * substitutes a default — an empty result is the caller's to interpret.
 */
export function parseExportColumns(
  requested: readonly string[],
): ExportColumn[] {
  const seen = new Set<ExportColumn>()
  for (const name of requested) {
    if ((EXPORT_COLUMNS as readonly string[]).includes(name)) {
      seen.add(name as ExportColumn)
    }
  }
  return [...seen]
}

export type ExportScope = "current" | "all"

/**
 * The filename segment that records what an export covers: "all" for the
 * whole table, the status for a status-filtered current export, and nothing
 * for an unfiltered current export.
 */
export function exportLabel(
  scope: ExportScope,
  status: PaymentStatus | "all",
): string | undefined {
  if (scope === "all") return "all"
  return status === "all" ? undefined : status
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
  const day = date.toISOString().slice(0, 10)
  const segment = label?.replace(/[^a-z0-9-]/gi, "")
  return segment
    ? `payments-${segment}-${day}.csv`
    : `payments-${day}.csv`
}
