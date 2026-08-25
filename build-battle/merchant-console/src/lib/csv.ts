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
 * Column names arrive from the client. `raw` is validated against
 * `EXPORT_COLUMNS` rather than trusted — anything else is dropped, not
 * passed through. `null` (the param wasn't sent at all) keeps today's
 * behavior of every column; an empty or all-invalid value resolves to an
 * empty list, which the caller must treat as "nothing to export."
 */
export function parseExportColumns(raw: string | null): ExportColumn[] {
  if (raw === null) return [...EXPORT_COLUMNS]

  const allowed: readonly string[] = EXPORT_COLUMNS
  const requested = new Set<ExportColumn>()
  for (const name of raw.split(",").map((part) => part.trim())) {
    if (allowed.includes(name)) requested.add(name as ExportColumn)
  }
  return [...requested]
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
 * Scope and the active status (when scoped to the current filter) fold into
 * the name so two different exports on the same day don't collide. When
 * neither applies, this is the same shape the export has always used.
 */
export function exportFilename(
  { scope, status }: { scope: "current" | "all"; status?: string },
  date = new Date(),
): string {
  const day = date.toISOString().slice(0, 10)
  if (scope === "all") return `payments-all-${day}.csv`
  if (status && status !== "all") return `payments-${status}-${day}.csv`
  return `payments-${day}.csv`
}
