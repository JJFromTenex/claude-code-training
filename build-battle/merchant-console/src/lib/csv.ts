import { merchantById } from "@/data/merchants"
import { Payment } from "@/data/types"
import { formatMoney } from "./money"

/**
 * CSV export for the payments table.
 *
 * The column set is fixed. Ops has asked for control over it — that is
 * NWP-101 — but today everyone gets every column, including the card
 * last four, whether or not the file is going to a merchant.
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
 * The columns selected when a request does not say otherwise: everything
 * except the card last four, which only belongs in a file when ops asks for it.
 */
export const DEFAULT_EXPORT_COLUMNS: readonly ExportColumn[] =
  EXPORT_COLUMNS.filter((column) => column !== "last4")

/** Human labels for the column picker. Keyed by the wire name. */
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

const EXPORT_COLUMN_SET: ReadonlySet<string> = new Set(EXPORT_COLUMNS)

function isExportColumn(value: string): value is ExportColumn {
  return EXPORT_COLUMN_SET.has(value)
}

/**
 * Turn a client-supplied `columns` value into a safe, ordered column list.
 *
 * Column names arrive from the browser, so this is the allowlist: anything not
 * in EXPORT_COLUMNS is dropped, duplicates collapse, and the caller's order is
 * kept. An empty or all-unknown input yields `[]`, which the route treats as
 * "nothing to export" rather than "every column".
 */
export function parseExportColumns(raw: string | null): ExportColumn[] {
  if (!raw) return []
  const seen = new Set<ExportColumn>()
  for (const part of raw.split(",")) {
    const name = part.trim()
    if (isExportColumn(name)) seen.add(name)
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

/**
 * Name the download after what is in it: an optional scope label (a status
 * filter, or "all") and the UTC date. Two exports on the same day collide by
 * design — the date is for the person filing it, not for uniqueness.
 */
export function exportFilename(label?: string, date = new Date()): string {
  const day = date.toISOString().slice(0, 10)
  return label ? `payments-${label}-${day}.csv` : `payments-${day}.csv`
}
