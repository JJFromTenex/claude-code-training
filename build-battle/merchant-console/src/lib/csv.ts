import { merchantById } from "@/data/merchants"
import { Payment, PaymentStatus } from "@/data/types"
import { formatMoney } from "./money"

/**
 * CSV export for the payments table.
 *
 * Ops chooses the columns and the scope (NWP-101). Both arrive from the
 * client, so both are checked here against an allowlist before they reach the
 * header row, the filename, or `cell()` — which has no default branch and
 * would write "undefined" for a name it does not know.
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

/** Columns that identify a cardholder. Off by default: the file is often merchant-bound. */
export const SENSITIVE_EXPORT_COLUMNS: readonly ExportColumn[] = ["last4"]

/** What an export gets when the client names no columns at all. */
export const DEFAULT_EXPORT_COLUMNS: readonly ExportColumn[] =
  EXPORT_COLUMNS.filter((column) => !SENSITIVE_EXPORT_COLUMNS.includes(column))

export function isExportColumn(value: string): value is ExportColumn {
  return (EXPORT_COLUMNS as readonly string[]).includes(value)
}

/**
 * Allowlist the `columns` query param. Accepts a repeated param or a comma
 * list, trims, drops empty tokens, and dedupes keeping the first order given.
 * Absent means the defaults, so old links keep working (minus last four).
 * An unknown name or an empty result is `null`, for the route to turn into a 400.
 */
export function parseExportColumns(
  params: URLSearchParams,
): readonly ExportColumn[] | null {
  const raw = params.getAll("columns")
  if (raw.length === 0) return DEFAULT_EXPORT_COLUMNS

  const chosen = new Set<ExportColumn>()
  for (const token of raw.flatMap((value) => value.split(","))) {
    const name = token.trim()
    if (name === "") continue
    if (!isExportColumn(name)) return null
    chosen.add(name)
  }
  return chosen.size > 0 ? [...chosen] : null
}

export const EXPORT_SCOPES = ["filter", "all"] as const

export type ExportScope = (typeof EXPORT_SCOPES)[number]

export function isExportScope(value: string): value is ExportScope {
  return (EXPORT_SCOPES as readonly string[]).includes(value)
}

/** Absent means the current filter, which is what the old link did. */
export function parseExportScope(params: URLSearchParams): ExportScope | null {
  const scope = params.get("scope")
  if (scope === null) return "filter"
  return isExportScope(scope) ? scope : null
}

/** Excel runs a cell that starts with one of these as a formula. */
const FORMULA_PREFIX = /^[=+@\t\r]/

/**
 * Quote what CSV needs quoted, and neutralise formula prefixes: these files
 * are opened in Excel by merchants. `-` is left alone on purpose — formatMoney
 * renders refunds as "-$5.00" and a guard there would corrupt every negative.
 */
function escapeCell(value: string): string {
  const safe = FORMULA_PREFIX.test(value) ? `'${value}` : value
  if (/[",\r\n]/.test(safe)) return `"${safe.replace(/"/g, '""')}"`
  return safe
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
 * `payments-<scope>-<utc date>.csv`. The scope segment is `all`, the active
 * status, or `filtered`. Every input is allowlisted upstream (`parseExportScope`,
 * `parseFilters`), which is what makes this safe inside a Content-Disposition header.
 */
export function exportFilename(
  scope: ExportScope,
  status: PaymentStatus | "all" | undefined,
  date = new Date(),
): string {
  const segment =
    scope === "all" ? "all" : status && status !== "all" ? status : "filtered"
  return `payments-${segment}-${date.toISOString().slice(0, 10)}.csv`
}
