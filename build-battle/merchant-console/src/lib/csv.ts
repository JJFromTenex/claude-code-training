import { merchantById } from "@/data/merchants"
import { Payment, PaymentStatus } from "@/data/types"
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

/** What a fresh export dialog starts with. Card last-four is opt-in, not opt-out. */
export const DEFAULT_EXPORT_COLUMNS: ExportColumn[] = EXPORT_COLUMNS.filter(
  (column) => column !== "last4",
)

export type ExportScope = "filtered" | "all"

/** Anything from the client is checked against an allowlist before it reaches a filename. */
export function parseExportScope(param: string | null): ExportScope {
  return param === "all" ? "all" : "filtered"
}

/**
 * Turns the client's requested column list into a validated column list.
 * `null` means "no `columns` param" (an older export link) and defaults to
 * the safe subset. A non-null, empty result means every requested column
 * failed the allowlist — the caller should reject rather than export nothing.
 */
export function parseExportColumns(param: string | null): ExportColumn[] | null {
  if (param === null) return DEFAULT_EXPORT_COLUMNS

  const valid = param
    .split(",")
    .map((column) => column.trim())
    .filter((column): column is ExportColumn =>
      (EXPORT_COLUMNS as readonly string[]).includes(column),
    )

  return valid.length > 0 ? valid : null
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

export function exportFilename(
  date = new Date(),
  options: { status?: PaymentStatus | "all"; scope?: ExportScope } = {},
): string {
  const { status = "all", scope = "filtered" } = options
  const stamp = date.toISOString().slice(0, 10)

  if (scope === "all") return `payments-all-${stamp}.csv`
  if (status !== "all") return `payments-${status}-${stamp}.csv`
  return `payments-${stamp}.csv`
}
