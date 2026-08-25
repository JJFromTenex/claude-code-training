import { merchantById } from "@/data/merchants"
import { Payment, PaymentStatus } from "@/data/types"
import { formatMoney } from "./money"

/**
 * CSV export for the payments table.
 *
 * Ops chooses the columns and the scope. Everything a caller can pick is
 * checked here against an allowlist before it reaches a serializer or a
 * response header — the choice arrives from a client and is not trusted.
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
 * What ops gets when they express no preference. The card last four is
 * opt-in and never automatic: most exports are handed to a merchant, and
 * stripping it by hand afterwards is the problem NWP-101 exists to remove.
 */
export const DEFAULT_EXPORT_COLUMNS: readonly ExportColumn[] =
  EXPORT_COLUMNS.filter((column) => column !== "last4")

/**
 * Column names arrive from the client, so every one is checked against
 * EXPORT_COLUMNS before it reaches a serializer.
 *
 * Returns the selection in the canonical column order, so the file is
 * identical however the boxes were clicked. Returns null for an empty
 * selection or an unrecognized name — both are rejected outright rather
 * than quietly repaired into something the caller did not ask for.
 */
export function parseExportColumns(
  values: readonly string[],
): ExportColumn[] | null {
  if (values.length === 0) return null

  const requested = new Set<string>()
  for (const value of values) {
    if (!EXPORT_COLUMNS.includes(value as ExportColumn)) return null
    requested.add(value)
  }

  return EXPORT_COLUMNS.filter((column) => requested.has(column))
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
 * Names the scope an export covers. A status when the filter is a status,
 * `filtered` when it is a merchant or a search, `all` when nothing narrows
 * it or the caller asked for every payment.
 */
export type ExportScope = "all" | "filtered" | PaymentStatus

const EXPORT_SCOPES: readonly string[] = [
  "all",
  "filtered",
  "authorized",
  "captured",
  "refunded",
  "failed",
  "disputed",
]

/**
 * `payments-disputed-2026-08-13.csv`.
 *
 * The token lands in a content-disposition header, so it is checked against
 * the allowlist here as well as at the route. An unrecognized scope falls
 * back to `all` rather than reaching the header — a newline in a filename is
 * a forged response, not a cosmetic bug.
 */
export function exportFilename(
  scope: ExportScope = "all",
  date = new Date(),
): string {
  const token = EXPORT_SCOPES.includes(scope) ? scope : "all"
  return `payments-${token}-${date.toISOString().slice(0, 10)}.csv`
}
