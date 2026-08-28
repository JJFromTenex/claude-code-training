import { merchantById } from "@/data/merchants"
import { Payment } from "@/data/types"
import { formatMoney } from "./money"

/**
 * CSV export for the payments table.
 *
 * Ops chooses the columns and the scope. The choice arrives from the client,
 * so `parseColumns` is the allowlist that stands between a query string and
 * the file: unknown names are dropped rather than trusted.
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
 * What the export dialog opens with. The card last four is deliberately absent:
 * most files go to a merchant, and it was being stripped by hand every time.
 * Ops can still tick it on.
 */
export const DEFAULT_COLUMNS: readonly ExportColumn[] = EXPORT_COLUMNS.filter(
  (column) => column !== "last4",
)

const KNOWN_COLUMNS = new Set<string>(EXPORT_COLUMNS)

/**
 * Column names arrive from the client, so they are checked against the
 * allowlist above before they reach the serializer or the filename.
 *
 * Order is the caller's, so ops gets the column order it asked for; duplicates
 * collapse; anything unrecognised is dropped. An omitted parameter means the
 * caller expressed no preference and gets the safe default. An empty one is a
 * deliberate empty selection, and the route rejects it.
 */
export function parseColumns(param: string | null): ExportColumn[] {
  if (param === null) return [...DEFAULT_COLUMNS]

  const chosen = new Set<ExportColumn>()
  for (const raw of param.split(",")) {
    const name = raw.trim()
    if (KNOWN_COLUMNS.has(name)) chosen.add(name as ExportColumn)
  }
  return [...chosen]
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
 * `payments-disputed-2026-08-13.csv`. The scope word tells ops which file on
 * their desktop is which, so it is part of the name rather than the metadata.
 *
 * The date is the UTC day, as everywhere else. The scope is derived from
 * already-validated filters, and is stripped again here because this string
 * ends up in a response header.
 */
export function exportFilename(date = new Date(), scope?: string): string {
  const day = date.toISOString().slice(0, 10)
  const slug = scope?.toLowerCase().replace(/[^a-z0-9-]/g, "")
  return slug ? `payments-${slug}-${day}.csv` : `payments-${day}.csv`
}
