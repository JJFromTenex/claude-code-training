import { merchantById } from "@/data/merchants"
import { Payment } from "@/data/types"
import { formatMoney } from "./money"

/**
 * CSV export for the payments table.
 *
 * Ops chooses the columns (NWP-101). The names arrive from the client, so the
 * request is checked against EXPORT_COLUMNS here and the route handler serves
 * only what came back. The card last four is off unless it is asked for by
 * name, because most of these files go to a merchant.
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

/** Everything except the card last four. */
export const DEFAULT_EXPORT_COLUMNS: readonly ExportColumn[] =
  EXPORT_COLUMNS.filter((column) => column !== "last4")

/** Human labels for the options dialog. The CSV header uses the column name. */
export const EXPORT_COLUMN_LABELS: Record<ExportColumn, string> = {
  id: "Payment ID",
  created_at: "Created (UTC)",
  merchant: "Merchant",
  description: "Description",
  status: "Status",
  method: "Method",
  card_brand: "Card brand",
  last4: "Card last four",
  amount: "Amount",
  currency: "Currency",
}

function isExportColumn(value: string): value is ExportColumn {
  return (EXPORT_COLUMNS as readonly string[]).includes(value)
}

export type ParsedColumns =
  | { columns: readonly ExportColumn[] }
  | { error: string }

/**
 * Validates a `columns` query parameter against the allowlist.
 *
 * An absent parameter means the caller wants the default set. A present but
 * empty one is a mistake worth reporting, not an empty file. Order is the
 * order asked for; duplicates collapse.
 */
export function parseExportColumns(
  raw: string | null | undefined,
): ParsedColumns {
  if (raw === null || raw === undefined) {
    return { columns: DEFAULT_EXPORT_COLUMNS }
  }

  const requested = raw
    .split(",")
    .map((name) => name.trim())
    .filter((name) => name.length > 0)

  if (requested.length === 0) {
    return { error: "Select at least one column to export." }
  }

  const unknown = requested.filter((name) => !isExportColumn(name))
  if (unknown.length > 0) {
    return { error: `Unknown export column: ${unknown.join(", ")}` }
  }

  const columns = requested.filter(isExportColumn)
  return { columns: [...new Set(columns)] }
}

export const EXPORT_SCOPES = ["filter", "all"] as const

export type ExportScope = (typeof EXPORT_SCOPES)[number]

/** Scope from the client, allowlisted. Anything unrecognized falls back to the filter. */
export function parseExportScope(raw: string | null | undefined): ExportScope {
  return raw === "all" ? "all" : "filter"
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
 * `payments-disputed-2026-08-13.csv`. The slug says what the file covers, so
 * two exports taken minutes apart are still tellable apart on disk.
 */
export function exportFilename(date = new Date(), scope?: string): string {
  const day = date.toISOString().slice(0, 10)
  const slug = scope
    ?.trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
  return slug ? `payments-${slug}-${day}.csv` : `payments-${day}.csv`
}
