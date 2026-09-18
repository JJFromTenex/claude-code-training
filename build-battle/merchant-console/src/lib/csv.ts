import { merchantById } from "@/data/merchants"
import { Payment, PaymentStatus } from "@/data/types"
import { formatMoney } from "./money"

/**
 * CSV export for the payments table.
 *
 * Ops chooses the columns and the scope (NWP-101). Column names arrive from
 * the client as a comma-separated list, so parseExportColumns is the
 * allowlist that keeps anything unrecognized out of toCsv.
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

/** Card last-four is off by default; everything else ships. */
export const DEFAULT_EXPORT_COLUMNS: readonly ExportColumn[] =
  EXPORT_COLUMNS.filter((column) => column !== "last4")

/**
 * Validates a client-supplied `columns` param against the allowlist.
 * Unknown names are dropped, duplicates are dropped, and the requested
 * order is preserved. No param at all falls back to the safe default.
 */
export function parseExportColumns(param: string | null): ExportColumn[] {
  if (param === null) return [...DEFAULT_EXPORT_COLUMNS]

  const known: readonly string[] = EXPORT_COLUMNS
  const seen = new Set<string>()
  const columns: ExportColumn[] = []

  for (const name of param.split(",").map((s) => s.trim())) {
    if (known.includes(name) && !seen.has(name)) {
      seen.add(name)
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

/**
 * Filename reflects the scope: "all" for every payment, the active status
 * when the current filter narrows to one (e.g. "disputed"), or "filtered"
 * for any other current-filter export.
 */
export function exportFilename(
  scope: "current" | "all",
  status: PaymentStatus | "all" | undefined,
  date = new Date(),
): string {
  const segment =
    scope === "all" ? "all" : status && status !== "all" ? status : "filtered"
  return `payments-${segment}-${date.toISOString().slice(0, 10)}.csv`
}
