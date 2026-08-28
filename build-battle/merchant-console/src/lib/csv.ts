import { merchantById } from "@/data/merchants"
import { Payment, PaymentFilters } from "@/data/types"
import { formatMoney } from "./money"

/**
 * CSV export for the payments table.
 *
 * Ops picks the column set and the scope (NWP-101). Column names arrive from
 * the client, so they are checked against EXPORT_COLUMNS here before they
 * reach a header row or a filename. The card last four is opt-in: a file with
 * card data on it should be a decision, not a default.
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
 * What ops gets unless they say otherwise. Derived from EXPORT_COLUMNS so the
 * two lists cannot drift — which also means a new sensitive column would
 * arrive switched on. The pinned test in csv.test.ts is there to catch that.
 */
export const DEFAULT_EXPORT_COLUMNS: readonly ExportColumn[] =
  EXPORT_COLUMNS.filter((column) => column !== "last4")

/** Whether the file is the filtered view or every payment in the store. */
export type ExportScope = "current" | "all"

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
  // Without this an empty selection returns a file of newlines, which is the
  // empty file NWP-101 exists to prevent. The route rejects first; this is the
  // backstop so no future caller can reach it.
  if (columns.length === 0) {
    throw new Error("toCsv needs at least one column")
  }

  const header = columns.join(",")
  const rows = payments.map((payment) =>
    columns.map((column) => escapeCell(cell(payment, column))).join(","),
  )
  return [header, ...rows].join("\n")
}

/**
 * Validates the client's column choice against the allowlist.
 *
 * Takes URLSearchParams to match parseFilters in @/data/queries — route
 * handlers call these rather than reading params themselves. Accepts either
 * `columns=id,amount` or repeated `columns=id&columns=amount`.
 *
 * No `columns` param means the caller has no opinion, and yields the defaults.
 * A `columns` param that resolves to nothing is an opinion — an empty file —
 * and yields an empty array so the route can refuse it.
 */
export function parseExportColumns(params: URLSearchParams): ExportColumn[] {
  const raw = params.getAll("columns")
  if (raw.length === 0) return [...DEFAULT_EXPORT_COLUMNS]

  const seen = new Set<string>()
  return raw
    .flatMap((value) => value.split(","))
    .map((value) => value.trim())
    .filter((value): value is ExportColumn => {
      if (!EXPORT_COLUMNS.includes(value as ExportColumn)) return false
      if (seen.has(value)) return false
      seen.add(value)
      return true
    })
}

/** Anything that is not exactly "all" is the safe, filtered default. */
export function parseExportScope(params: URLSearchParams): ExportScope {
  return params.get("scope") === "all" ? "all" : "current"
}

/** The word in the filename between "payments" and the date. */
export function exportScopeSegment(
  scope: ExportScope,
  filters: PaymentFilters,
): string {
  if (scope === "all") return "all"
  if (filters.status && filters.status !== "all") return filters.status
  const narrowed =
    filters.merchantId || filters.search || filters.from || filters.to
  return narrowed ? "filtered" : "all"
}

/**
 * `date` stays the first parameter so existing callers keep working. The
 * segment is already allowlist-derived; scrubbing it here means nothing can
 * smuggle a quote or a newline into the content-disposition header.
 */
export function exportFilename(date = new Date(), segment?: string): string {
  const stamp = date.toISOString().slice(0, 10)
  const slug = (segment ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
  return slug ? `payments-${slug}-${stamp}.csv` : `payments-${stamp}.csv`
}
