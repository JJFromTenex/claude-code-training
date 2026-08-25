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

/** Columns preselected in the export dialog. Card last-four is opt-in, not opt-out. */
export const DEFAULT_EXPORT_COLUMNS: readonly ExportColumn[] = EXPORT_COLUMNS.filter(
  (column) => column !== "last4",
)

export type ExportScope = "current" | "all"

/**
 * Column names arrive from the client as a comma-separated `columns` param.
 * Anything not in EXPORT_COLUMNS is dropped rather than erroring — an unknown
 * name is never interpolated into the header or the cell lookup.
 *
 * A missing param means "not specified yet", so it falls back to the default
 * set. A present-but-empty param is a deliberate empty selection and returns
 * an empty array, since that's a real state the export dialog can produce.
 */
export function parseColumns(param: string | null): ExportColumn[] {
  if (param === null) return [...DEFAULT_EXPORT_COLUMNS]

  const requested = param.split(",").map((c) => c.trim())
  const seen = new Set<ExportColumn>()
  const columns: ExportColumn[] = []
  for (const name of requested) {
    if ((EXPORT_COLUMNS as readonly string[]).includes(name) && !seen.has(name as ExportColumn)) {
      seen.add(name as ExportColumn)
      columns.push(name as ExportColumn)
    }
  }
  return columns
}

/** Anything other than "all" is "current" — the safer, narrower default. */
export function parseScope(param: string | null): ExportScope {
  return param === "all" ? "all" : "current"
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
 * The "all payments" scope always tokens as "all". The "current filter" scope
 * tokens as the active status when one is set, since that's the common case
 * (a merchant asking for "the disputed ones"); any other filter combination
 * falls back to the generic "filtered" rather than trying to encode every
 * possible filter into a filename.
 */
export function exportFilename(
  scope: ExportScope,
  status: PaymentStatus | "all" | undefined,
  date = new Date(),
): string {
  const token = scope === "all" ? "all" : status && status !== "all" ? status : "filtered"
  return `payments-${token}-${date.toISOString().slice(0, 10)}.csv`
}
