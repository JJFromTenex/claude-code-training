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

/** Card last-four off by default — ops opts in by naming it explicitly. */
export const DEFAULT_EXPORT_COLUMNS: readonly ExportColumn[] = EXPORT_COLUMNS.filter(
  (column) => column !== "last4",
)

/**
 * Column names arrive from the client as a comma-separated list. Anything not
 * in EXPORT_COLUMNS is dropped rather than reaching toCsv or a query — never
 * trust a column name enough to interpolate it anywhere.
 *
 * No `columns` param at all keeps the safe default (last-four excluded). An
 * explicit empty string is a deliberate empty selection, not "give me
 * everything" — it returns no columns.
 */
export function parseColumns(raw: string | null): ExportColumn[] {
  if (raw === null) return [...DEFAULT_EXPORT_COLUMNS]

  const seen = new Set<ExportColumn>()
  for (const name of raw.split(",").map((c) => c.trim())) {
    if ((EXPORT_COLUMNS as readonly string[]).includes(name)) {
      seen.add(name as ExportColumn)
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

/** `label` is the scope segment — a status like "disputed", or "all". Omit for the plain filename. */
export function exportFilename(date = new Date(), label?: string): string {
  const day = date.toISOString().slice(0, 10)
  return label ? `payments-${label}-${day}.csv` : `payments-${day}.csv`
}
