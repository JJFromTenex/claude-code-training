import { merchantById } from "@/data/merchants"
import { Payment, PaymentStatus } from "@/data/types"
import { formatMoney } from "./money"

/**
 * CSV export for the payments table.
 *
 * Ops picks the column set per export (NWP-101). EXPORT_COLUMNS is every
 * column the serializer knows how to write, and doubles as the allowlist that
 * client input is checked against. Validation happens here rather than inside
 * toCsv because cell() has no default branch: an unchecked column name would
 * render as a header with blank cells under it and never throw.
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
 * Columns ops opts into rather than out of. `last4` is card data, and a file
 * that carries it has to be cleaned by hand before it can go to a merchant —
 * which is the manual step NWP-101 exists to remove. Naming the exclusion
 * rather than hand-writing a second tuple means a benign column added later
 * reaches ops automatically instead of being withheld by accident.
 */
const SENSITIVE_EXPORT_COLUMNS: readonly ExportColumn[] = ["last4"]

export const DEFAULT_EXPORT_COLUMNS: readonly ExportColumn[] =
  EXPORT_COLUMNS.filter((column) => !SENSITIVE_EXPORT_COLUMNS.includes(column))

/**
 * What the filename says is in the file. A union rather than a bare string,
 * so a raw search param cannot reach a Content-Disposition header without a
 * cast a reviewer would see.
 */
export type ExportScope = "all" | "filtered" | PaymentStatus

function isExportColumn(value: string): value is ExportColumn {
  return (EXPORT_COLUMNS as readonly string[]).includes(value)
}

/**
 * Turn the client's `columns` parameter into a column list.
 *
 * The requested order is the file's order, so ops can lead with the columns
 * Finance reads first. Unknown names are dropped rather than trusted — an
 * unknown name can only ever remove a column, never leak one. An empty result
 * comes back empty rather than falling back to the defaults, so the caller can
 * tell "asked for nothing" apart from "asked for nothing in particular" and
 * refuse the first.
 */
export function parseExportColumns(raw: string | null): ExportColumn[] {
  if (raw === null) return [...DEFAULT_EXPORT_COLUMNS]
  const requested = raw
    .split(",")
    .map((name) => name.trim())
    .filter(isExportColumn)
  return [...new Set(requested)]
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
 * `payments-disputed-2026-08-13.csv`. The scope segment says what is in the
 * file, so two exports pulled on the same day are told apart by their contents
 * rather than by who downloaded them. The segment is stripped to filename-safe
 * characters on the way through: it is interpolated into a quoted header, and
 * the type is the only other thing standing between a param and that header.
 */
export function exportFilename(date = new Date(), scope?: ExportScope): string {
  const day = date.toISOString().slice(0, 10)
  const segment = scope?.replace(/[^a-z0-9-]/gi, "")
  return segment ? `payments-${segment}-${day}.csv` : `payments-${day}.csv`
}
