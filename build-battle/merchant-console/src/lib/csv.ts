import { merchantById } from "@/data/merchants"
import { Payment } from "@/data/types"
import { formatMoney } from "./money"

/**
 * CSV export for the payments table.
 *
 * Ops chooses which columns ship and whether the export is scoped to the
 * current filter or all payments (NWP-101) — see the export route and
 * `export-dialog.tsx`. `EXPORT_COLUMNS` is the full, ordered allowlist;
 * `parseExportColumns` validates whatever subset the client requests
 * against it.
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
 * Validates a client-supplied `columns` param against the allowlist.
 * Unknown entries are dropped rather than rejected outright; the caller
 * decides what to do if the result is empty. `null` (param absent) means
 * "not specified" and returns every column, not none.
 */
export function parseExportColumns(raw: string | null): ExportColumn[] {
  if (raw === null) return [...EXPORT_COLUMNS]
  const requested = raw.split(",").map((c) => c.trim()).filter(Boolean)
  return requested.filter((c): c is ExportColumn =>
    (EXPORT_COLUMNS as readonly string[]).includes(c),
  )
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
