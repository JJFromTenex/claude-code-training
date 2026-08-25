import { merchantById } from "@/data/merchants"
import { Payment, PaymentFilters, PaymentStatus } from "@/data/types"
import { formatMoney } from "./money"

/**
 * CSV export for the payments table.
 *
 * Ops chooses the columns. `EXPORT_COLUMNS` is the allowlist a request is
 * checked against, and the card last four is left out unless it is asked
 * for by name, because most of these files go to a merchant.
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

/** Columns sent to a merchant by default. The card last four is opt-in. */
export const DEFAULT_EXPORT_COLUMNS: readonly ExportColumn[] =
  EXPORT_COLUMNS.filter((column) => column !== "last4")

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
  columns: readonly ExportColumn[] = DEFAULT_EXPORT_COLUMNS,
): string {
  const header = columns.join(",")
  const rows = payments.map((payment) =>
    columns.map((column) => escapeCell(cell(payment, column))).join(","),
  )
  return [header, ...rows].join("\n")
}

/**
 * Turn the `columns` query param into a column set.
 *
 * Anything not in `EXPORT_COLUMNS` is dropped rather than echoed, so a name
 * from the client never reaches a header row or a filename. An absent param
 * means "no preference" and yields the default set; an empty one means the
 * caller deselected everything, which the route rejects.
 */
export function parseExportColumns(raw: string | null): ExportColumn[] {
  if (raw === null) return [...DEFAULT_EXPORT_COLUMNS]

  const allowed = new Set<string>(EXPORT_COLUMNS)
  const seen = new Set<string>()

  return raw.split(",").reduce<ExportColumn[]>((columns, value) => {
    const name = value.trim()
    if (allowed.has(name) && !seen.has(name)) {
      seen.add(name)
      columns.push(name as ExportColumn)
    }
    return columns
  }, [])
}

/** Either the filters currently on screen, or every payment. */
export type ExportScope = "filter" | "all"

/** The closed set a filename's scope segment can be drawn from. */
export type ExportScopeLabel = PaymentStatus | "all" | "filtered"

/** Narrow the `scope` query param. Anything unrecognized falls back to the filters. */
export function parseExportScope(raw: string | null): ExportScope {
  return raw === "all" ? "all" : "filter"
}

/**
 * The scope segment of the filename, built from validated filters only.
 *
 * A status names itself, so `payments-disputed-…` says what is inside — but
 * only when the status is the *whole* story. A file narrowed to one merchant
 * as well is `filtered`, because naming it `disputed` would describe a set
 * far larger than what it holds, which is the near-miss the ticket is about.
 * An under-promising name is safe; an over-promising one is not.
 */
export function exportScopeLabel(
  filters: PaymentFilters,
  scope: ExportScope,
): ExportScopeLabel {
  if (scope === "all") return "all"

  const status =
    filters.status && filters.status !== "all" ? filters.status : null
  // A whitespace-only search narrows nothing: the builder trims it away too.
  const narrowedFurther = Boolean(
    filters.merchantId || filters.search?.trim() || filters.from || filters.to,
  )

  if (status) return narrowedFurther ? "filtered" : status
  return narrowedFurther ? "filtered" : "all"
}

/**
 * `payments-disputed-2026-08-13.csv`. The date is the UTC calendar day.
 *
 * The scope is typed to a closed set rather than `string`, so no future caller
 * can hand client input to a response header through this.
 */
export function exportFilename(
  scope: ExportScopeLabel,
  date = new Date(),
): string {
  return `payments-${scope}-${date.toISOString().slice(0, 10)}.csv`
}
