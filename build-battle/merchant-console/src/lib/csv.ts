import { merchantById } from "@/data/merchants"
import { Payment } from "@/data/types"
import { formatMoney } from "./money"

/**
 * CSV export for the payments table.
 *
 * Column selection (NWP-101): callers pass whichever `ExportColumn[]` the
 * ops user chose, in the order they chose it. Card last-four is opt-in.
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

/** Columns preselected in the export dialog. Card last-four is opt-in, not opt-out. */
export const DEFAULT_EXPORT_COLUMNS: readonly ExportColumn[] = EXPORT_COLUMNS.filter(
  (column) => column !== "last4",
)

export const EXPORT_COLUMN_LABELS: Record<ExportColumn, string> = {
  id: "Payment ID",
  created_at: "Date",
  merchant: "Merchant",
  description: "Description",
  status: "Status",
  method: "Method",
  card_brand: "Card brand",
  last4: "Card last 4",
  amount: "Amount",
  currency: "Currency",
}

/**
 * Column names arrive from the client. Checked against the allowlist before
 * they reach `toCsv`. An empty or fully-invalid selection returns `[]` —
 * it is never expanded back out to "every column".
 */
export function parseExportColumns(raw: string | null): ExportColumn[] {
  if (!raw) return []
  const requested = raw.split(",").map((value) => value.trim())
  const seen = new Set<ExportColumn>()
  for (const value of requested) {
    if ((EXPORT_COLUMNS as readonly string[]).includes(value)) {
      seen.add(value as ExportColumn)
    }
  }
  return [...seen]
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

export function exportFilename(date = new Date(), scopeLabel?: string): string {
  const stamp = date.toISOString().slice(0, 10)
  return scopeLabel ? `payments-${scopeLabel}-${stamp}.csv` : `payments-${stamp}.csv`
}
