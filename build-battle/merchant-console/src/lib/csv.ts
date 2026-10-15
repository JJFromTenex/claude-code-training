import { merchantById } from "@/data/merchants"
import { Payment, PaymentFilters } from "@/data/types"
import { formatMoney } from "./money"

/**
 * CSV export for the payments table.
 *
 * Ops chooses the columns and the scope (NWP-101). Both arrive from the
 * client, so they are checked here against allowlists before they reach the
 * query, the file, or the filename. Card last four is off unless asked for.
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

/** What a file gets when ops has not chosen: everything but card last four. */
export const DEFAULT_EXPORT_COLUMNS: readonly ExportColumn[] =
  EXPORT_COLUMNS.filter((column) => column !== "last4")

export const EXPORT_SCOPES = ["filter", "all"] as const

export type ExportScope = (typeof EXPORT_SCOPES)[number]

export type ExportOptions =
  | { ok: true; scope: ExportScope; columns: readonly ExportColumn[] }
  | { ok: false; error: string }

/**
 * Validates the export's `scope` and `columns` params against allowlists.
 * Columns come back in canonical order, and an amount always travels with
 * its currency. No `columns` param means the default set; an empty one is
 * rejected, because an export with no columns is a mistake, not a file.
 */
export function parseExportOptions(params: URLSearchParams): ExportOptions {
  const scope = params.get("scope") ?? "filter"
  if (!EXPORT_SCOPES.includes(scope as ExportScope)) {
    return { ok: false, error: `Unknown scope: ${scope}` }
  }

  const raw = params.get("columns")
  if (raw === null) {
    return {
      ok: true,
      scope: scope as ExportScope,
      columns: DEFAULT_EXPORT_COLUMNS,
    }
  }

  const requested = raw
    .split(",")
    .map((column) => column.trim())
    .filter(Boolean)
  if (requested.length === 0) {
    return { ok: false, error: "Choose at least one column to export." }
  }

  const unknown = requested.find(
    (column) => !EXPORT_COLUMNS.includes(column as ExportColumn),
  )
  if (unknown) return { ok: false, error: `Unknown column: ${unknown}` }

  const chosen = new Set(requested as ExportColumn[])
  if (chosen.has("amount")) chosen.add("currency")

  return {
    ok: true,
    scope: scope as ExportScope,
    columns: EXPORT_COLUMNS.filter((column) => chosen.has(column)),
  }
}

/**
 * The scope segment of the filename. Only allowlisted values reach it: a
 * parsed status, "all", or "filtered". Merchant ids and search text never do.
 */
export function exportScopeLabel(
  scope: ExportScope,
  filters: PaymentFilters,
): string {
  if (scope === "all") return "all"
  if (filters.status && filters.status !== "all") return filters.status
  if (filters.merchantId || filters.search || filters.from || filters.to) {
    return "filtered"
  }
  return "all"
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

/** `label` must come from `exportScopeLabel`, never straight from the client. */
export function exportFilename(date = new Date(), label?: string): string {
  const day = date.toISOString().slice(0, 10)
  return label ? `payments-${label}-${day}.csv` : `payments-${day}.csv`
}
