import { merchantById } from "@/data/merchants"
import { Payment, PaymentFilters } from "@/data/types"
import { formatMoney } from "./money"

/**
 * CSV export for the payments table.
 *
 * Ops picks the columns and the scope; both arrive from the client and are
 * checked against the allowlists here before they reach a serializer or a
 * filename.
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
 * What ops gets when they have not chosen. Card last four is excluded: most
 * exports go to a merchant, and today they are cleaned up by hand first.
 */
export const DEFAULT_EXPORT_COLUMNS: readonly ExportColumn[] =
  EXPORT_COLUMNS.filter((column) => column !== "last4")

export const EXPORT_COLUMN_LABELS: Record<ExportColumn, string> = {
  id: "Payment ID",
  created_at: "Created at (UTC)",
  merchant: "Merchant",
  description: "Description",
  status: "Status",
  method: "Method",
  card_brand: "Card brand",
  last4: "Card last four",
  amount: "Amount",
  currency: "Currency",
}

export const EXPORT_SCOPES = ["filter", "all"] as const

export type ExportScope = (typeof EXPORT_SCOPES)[number]

function isExportColumn(value: string): value is ExportColumn {
  return EXPORT_COLUMNS.some((column) => column === value)
}

/**
 * Validate a client-supplied `columns` parameter against the allowlist.
 *
 * An absent parameter means "no choice was made" and yields the defaults. A
 * parameter that is present but names nothing recognized yields an empty
 * array, which callers treat as a bad request rather than an empty file.
 */
export function parseExportColumns(
  param: string | null | undefined,
): ExportColumn[] {
  if (param === null || param === undefined) return [...DEFAULT_EXPORT_COLUMNS]

  const seen = new Set<ExportColumn>()
  for (const raw of param.split(",")) {
    const candidate = raw.trim()
    if (isExportColumn(candidate)) seen.add(candidate)
  }
  return [...seen]
}

export function parseExportScope(param: string | null | undefined): ExportScope {
  return EXPORT_SCOPES.find((scope) => scope === param) ?? "filter"
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
 * The word that describes what is in the file: the status when the export is
 * narrowed to one, `all` when scope ignores the filters, `filtered` when some
 * other filter is active, and nothing when the file is simply every payment.
 */
export function exportScopeSlug(
  scope: ExportScope,
  filters: PaymentFilters,
): string | undefined {
  if (scope === "all") return "all"
  if (filters.status && filters.status !== "all") return filters.status
  if (filters.merchantId || filters.search || filters.from || filters.to) {
    return "filtered"
  }
  return undefined
}

/**
 * `payments-disputed-2026-08-13.csv`. The scope is slugged rather than
 * interpolated raw — it ends up in a response header.
 */
export function exportFilename(date = new Date(), scope?: string): string {
  const slug = scope
    ?.toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")

  const parts = ["payments", slug, date.toISOString().slice(0, 10)].filter(
    Boolean,
  )
  return `${parts.join("-")}.csv`
}
