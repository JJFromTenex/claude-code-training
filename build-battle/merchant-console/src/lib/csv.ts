import { merchantById } from "@/data/merchants"
import { Payment, PaymentFilters } from "@/data/types"
import { formatMoney } from "./money"

/**
 * CSV export for the payments table.
 *
 * Ops picks the columns and the scope; both arrive from the client, so both
 * are resolved against the allowlist below before they reach a file or a
 * filename. The card last four is left out unless it is asked for, because
 * the file is usually on its way to a merchant.
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

export type ExportScope = "filtered" | "all"

/** Everything except the card last four. What you get when nobody chooses. */
export const DEFAULT_EXPORT_COLUMNS = EXPORT_COLUMNS.filter(
  (column) => column !== "last4",
)

export const EXPORT_COLUMN_LABELS: Record<ExportColumn, string> = {
  id: "Payment ID",
  created_at: "Created (UTC)",
  merchant: "Merchant",
  description: "Description",
  status: "Status",
  method: "Method",
  card_brand: "Card brand",
  last4: "Card last four",
  amount: "Amount",
  currency: "Currency",
}

const isExportColumn = (value: string): value is ExportColumn =>
  (EXPORT_COLUMNS as readonly string[]).includes(value)

/**
 * Resolves the requested columns against the allowlist, keeping the order
 * they were asked for and dropping anything unrecognised.
 *
 * No `columns` param and an empty one are different questions. Absent means
 * nobody chose, so the default set applies. Empty means every box was
 * unchecked, which returns null so the caller can reject it rather than hand
 * back a file with a blank header and no data.
 */
export function parseExportColumns(
  params: URLSearchParams,
): ExportColumn[] | null {
  const requested = params.get("columns")
  if (requested === null) return [...DEFAULT_EXPORT_COLUMNS]

  const columns: ExportColumn[] = []
  for (const name of requested.split(",")) {
    const column = name.trim()
    if (isExportColumn(column) && !columns.includes(column)) {
      columns.push(column)
    }
  }

  return columns.length > 0 ? columns : null
}

export function parseExportScope(params: URLSearchParams): ExportScope {
  return params.get("scope") === "all" ? "all" : "filtered"
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
 * Names the file after what is in it, so two exports taken minutes apart are
 * still tellable apart on disk.
 *
 * Only the scope literal and the already-allowlisted status reach the name.
 * Search text and merchant names deliberately do not: this string ends up in
 * a Content-Disposition header.
 */
export function exportFilename(
  date = new Date(),
  scope: ExportScope = "filtered",
  status: PaymentFilters["status"] = "all",
): string {
  const day = date.toISOString().slice(0, 10)
  const descriptor = scope === "all" ? "all" : status === "all" ? null : status
  return descriptor
    ? `payments-${descriptor}-${day}.csv`
    : `payments-${day}.csv`
}
