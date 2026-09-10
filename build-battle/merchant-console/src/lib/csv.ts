import { merchantById } from "@/data/merchants"
import { Payment } from "@/data/types"
import { formatMoney } from "./money"

/**
 * CSV export for the payments table.
 *
 * Ops chooses the columns and the scope (NWP-101). `EXPORT_COLUMNS` is the
 * allowlist every request is checked against; `DEFAULT_EXPORT_COLUMNS` is what
 * a request that names none gets, and it deliberately leaves out the card last
 * four so a file headed to a merchant is safe before anyone edits it.
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
 * What you get when a request names no columns: everything except the card
 * last four. The default is enforced here rather than in the dialog, so a
 * hand-built URL cannot quietly put last four back in the file.
 */
export const DEFAULT_EXPORT_COLUMNS: readonly ExportColumn[] =
  EXPORT_COLUMNS.filter((column) => column !== "last4")

/**
 * Resolves the client's `columns` param against the allowlist.
 *
 * Strict on purpose: names are case-sensitive and carry no whitespace, order
 * is preserved, and duplicates collapse to their first occurrence. Anything
 * unusable — an unknown name, an empty segment, an empty param — returns
 * `null`, which the route turns into a 400. Coercing a bad list to the default
 * would hand ops a file with different columns than they asked for, which is
 * the failure this ticket exists to prevent.
 */
export function parseExportColumns(
  param: string | null,
): readonly ExportColumn[] | null {
  if (param === null) return DEFAULT_EXPORT_COLUMNS
  if (param === "") return null

  const allowed = new Set<string>(EXPORT_COLUMNS)
  const selected: ExportColumn[] = []

  for (const name of param.split(",")) {
    if (!allowed.has(name)) return null
    if (!selected.includes(name as ExportColumn)) selected.push(name as ExportColumn)
  }

  return selected.length > 0 ? selected : null
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
 * `payments-[scope-]YYYY-MM-DD.csv`, stamped in UTC.
 *
 * The date stays the first parameter so existing callers are unaffected. The
 * scope label is chosen by the route from allowlisted values only — raw client
 * input never reaches a filename.
 */
export function exportFilename(date = new Date(), scope?: string): string {
  const stamp = date.toISOString().slice(0, 10)
  return scope ? `payments-${scope}-${stamp}.csv` : `payments-${stamp}.csv`
}
