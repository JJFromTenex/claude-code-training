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

/** Every column except the one that costs ops a manual scrub before a file can go to a merchant. */
export const DEFAULT_EXPORT_COLUMNS: readonly ExportColumn[] = EXPORT_COLUMNS.filter(
  (column) => column !== "last4",
)

const EXPORT_COLUMN_SET = new Set<string>(EXPORT_COLUMNS)

/**
 * Column names arrive from the client as a comma-separated list. Anything not
 * on the allowlist is dropped, never interpolated anywhere. `null` (the param
 * was absent) falls back to the safe default; `""` (present but empty) is a
 * deliberate empty selection and returns no columns.
 */
export function parseExportColumns(raw: string | null): ExportColumn[] {
  if (raw === null) return [...DEFAULT_EXPORT_COLUMNS]

  const seen = new Set<string>()
  const columns: ExportColumn[] = []
  for (const candidate of raw.split(",")) {
    const name = candidate.trim()
    if (!name || seen.has(name) || !EXPORT_COLUMN_SET.has(name)) continue
    seen.add(name)
    columns.push(name as ExportColumn)
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

export type ExportScope = "filtered" | "all"

/**
 * `all` always reads as "all". `filtered` reads as the active status when
 * there is one (`payments-disputed-...`), or `filtered` when the current
 * filter is just "every status" narrowed some other way (merchant, search,
 * date range).
 */
export function exportFilename(
  scope: ExportScope,
  statusFilter: string | undefined,
  date = new Date(),
): string {
  const label =
    scope === "all" ? "all" : statusFilter && statusFilter !== "all" ? statusFilter : "filtered"
  return `payments-${label}-${date.toISOString().slice(0, 10)}.csv`
}
