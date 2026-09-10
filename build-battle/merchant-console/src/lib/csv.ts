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
 * The columns ops gets unless they say otherwise. Card last-four is off by
 * default (NWP-101): most exports go to a merchant and must not carry it.
 */
export const DEFAULT_EXPORT_COLUMNS = EXPORT_COLUMNS.filter(
  (column) => column !== "last4",
)

/**
 * Column names arrive from the client, so they are checked against the
 * EXPORT_COLUMNS allowlist here — never interpolated anywhere. Order is the
 * caller's; unknown names are dropped and duplicates collapse to the first.
 */
export function parseColumns(input: string | null | undefined): ExportColumn[] {
  if (!input) return []
  const allowed = new Set<string>(EXPORT_COLUMNS)
  const seen = new Set<string>()
  const columns: ExportColumn[] = []
  for (const raw of input.split(",")) {
    const name = raw.trim()
    if (allowed.has(name) && !seen.has(name)) {
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
 * Filename reflects the scope and the date, e.g. `payments-disputed-2026-08-13.csv`.
 * With no scope slug it falls back to the plain `payments-<date>.csv`.
 */
export function exportFilename(scopeSlug?: string, date = new Date()): string {
  const stamp = date.toISOString().slice(0, 10)
  const slug = scopeSlug?.trim().toLowerCase()
  return slug ? `payments-${slug}-${stamp}.csv` : `payments-${stamp}.csv`
}
