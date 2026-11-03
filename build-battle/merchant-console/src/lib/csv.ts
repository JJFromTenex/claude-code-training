import { merchantById } from "@/data/merchants"
import { Payment, PaymentFilters } from "@/data/types"
import { formatMoney } from "./money"

/**
 * CSV export for the payments table.
 *
 * Ops chooses the columns and the scope (NWP-101). Both arrive from the
 * client, so both are checked against the allowlists below before they reach
 * the serializer or the filename.
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
 * What ships when nobody chooses: every column except the card last four.
 * Files go to merchants, so the last four is opt-in.
 */
export const DEFAULT_EXPORT_COLUMNS: readonly ExportColumn[] =
  EXPORT_COLUMNS.filter((column) => column !== "last4")

export const EXPORT_SCOPES = ["filtered", "all"] as const

export type ExportScope = (typeof EXPORT_SCOPES)[number]

export type ParsedExportColumns =
  | { ok: true; columns: ExportColumn[] }
  | { ok: false; error: string }

function isExportColumn(value: string): value is ExportColumn {
  return (EXPORT_COLUMNS as readonly string[]).includes(value)
}

/**
 * Parse the `columns` query param, a comma-separated list. Order is kept and
 * duplicates are dropped. A missing param means the defaults; an empty list
 * or any unknown name is rejected rather than producing a surprising file.
 */
export function parseExportColumns(raw: string | null): ParsedExportColumns {
  if (raw === null) return { ok: true, columns: [...DEFAULT_EXPORT_COLUMNS] }

  const requested = raw.split(",").map((name) => name.trim())
  if (requested.every((name) => name === "")) {
    return { ok: false, error: "Choose at least one column to export." }
  }

  const columns: ExportColumn[] = []
  for (const name of requested) {
    if (!isExportColumn(name)) {
      return {
        ok: false,
        error: `Unknown export column. Allowed: ${EXPORT_COLUMNS.join(", ")}.`,
      }
    }
    if (!columns.includes(name)) columns.push(name)
  }
  return { ok: true, columns }
}

/** Parse the `scope` query param. Missing means the current filter; anything unknown is null. */
export function parseExportScope(raw: string | null): ExportScope | null {
  if (raw === null) return "filtered"
  return (EXPORT_SCOPES as readonly string[]).includes(raw)
    ? (raw as ExportScope)
    : null
}

/**
 * The scope word in the filename. Built only from allowlisted values (the
 * scope and a validated status), never from free text like a search.
 */
export function exportScopeLabel(
  scope: ExportScope,
  filters: PaymentFilters,
): string {
  if (scope === "all") return "all"
  if (filters.status && filters.status !== "all") return filters.status
  const filtered =
    filters.merchantId || filters.search || filters.from || filters.to
  return filtered ? "filtered" : "all"
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

/** UTC date, with the scope label when one is given: payments-disputed-2026-08-13.csv */
export function exportFilename(date = new Date(), label?: string): string {
  const day = date.toISOString().slice(0, 10)
  return label ? `payments-${label}-${day}.csv` : `payments-${day}.csv`
}
