import { merchantById } from "@/data/merchants"
import { Payment, PaymentStatus } from "@/data/types"
import { formatMoney } from "./money"

/**
 * CSV export for the payments table.
 *
 * Ops chooses which columns ship and how wide the scope is (NWP-101). Both
 * arrive from the client, so both are allowlisted before they reach this file
 * — see `parseExportOptions` in `@/data/queries`.
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
 * What ops gets without choosing: everything except the card last four, which
 * is the column that has to be stripped by hand before a file goes to a
 * merchant. Opt in to it, never out.
 */
export const DEFAULT_EXPORT_COLUMNS: readonly ExportColumn[] =
  EXPORT_COLUMNS.filter((column) => column !== "last4")

export const EXPORT_SCOPES = ["filtered", "all"] as const

export type ExportScope = (typeof EXPORT_SCOPES)[number]

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
 * The middle segment of the filename, so a file names its own scope: an
 * unedited merchant-filtered export is no longer indistinguishable from a
 * complete one. Derived from values that have already been validated, never
 * from a raw client string.
 */
export function exportSegment(
  scope: ExportScope,
  status: PaymentStatus | "all" = "all",
): string {
  if (scope === "all") return "all"
  return status === "all" ? "filtered" : status
}

export function exportFilename(date = new Date(), segment?: string): string {
  const stamp = date.toISOString().slice(0, 10)
  return segment ? `payments-${segment}-${stamp}.csv` : `payments-${stamp}.csv`
}
