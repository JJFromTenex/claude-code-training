import { merchantById } from "@/data/merchants"
import { Payment } from "@/data/types"
import { formatMoney } from "./money"

/**
 * CSV export for the payments table.
 *
 * Ops picks the columns and the scope (NWP-101). `EXPORT_COLUMNS` is the
 * allowlist every client selection is checked against; `DEFAULT_EXPORT_COLUMNS`
 * is what ships when nothing is chosen, and it leaves the card last four off.
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

/** Human labels for the export dialog. Keyed by the CSV column name. */
export const COLUMN_LABELS: Record<ExportColumn, string> = {
  id: "Payment ID",
  created_at: "Created",
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
 * What ships when the caller names no columns. Card last four is off by
 * default so a file bound for a merchant does not leak it (NWP-101).
 */
export const DEFAULT_EXPORT_COLUMNS: readonly ExportColumn[] =
  EXPORT_COLUMNS.filter((column) => column !== "last4")

/**
 * Validate a client-supplied `columns` string against the allowlist.
 *
 * Splits on commas, keeps only known column names in the order requested, and
 * drops unknowns and duplicates. An empty or all-invalid input yields `[]`, so
 * the caller can reject it rather than write a header-only file.
 */
export function parseColumns(param: string | null): ExportColumn[] {
  if (!param) return []
  const allowed = new Set<string>(EXPORT_COLUMNS)
  const seen = new Set<ExportColumn>()
  const columns: ExportColumn[] = []
  for (const raw of param.split(",")) {
    const name = raw.trim()
    if (allowed.has(name) && !seen.has(name as ExportColumn)) {
      seen.add(name as ExportColumn)
      columns.push(name as ExportColumn)
    }
  }
  return columns
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
  const stamp = date.toISOString().slice(0, 10)
  return label ? `payments-${label}-${stamp}.csv` : `payments-${stamp}.csv`
}
