import { merchantById } from "@/data/merchants"
import { Payment } from "@/data/types"
import { formatMoney } from "./money"

/**
 * CSV export for the payments table.
 *
 * Ops chooses the columns (NWP-101). EXPORT_COLUMNS is the allowlist of what
 * may be asked for; DEFAULT_EXPORT_COLUMNS is what ops gets without asking,
 * which excludes the card last four so a file bound for a merchant is clean
 * by default.
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
 * Selected when the client asks for nothing in particular. The card last four
 * is off: it is the one column that turns an export into a data-handling
 * problem, so including it is a decision someone has to make on purpose.
 */
export const DEFAULT_EXPORT_COLUMNS: readonly ExportColumn[] =
  EXPORT_COLUMNS.filter((column) => column !== "last4")

function isExportColumn(value: string): value is ExportColumn {
  return (EXPORT_COLUMNS as readonly string[]).includes(value)
}

/**
 * Validate a client-supplied column list against the allowlist.
 *
 * Column names arrive from the browser, so nothing here trusts them: unknown
 * names are dropped rather than passed along, duplicates collapse, and the
 * caller's order is preserved because ops orders columns to match whatever
 * spreadsheet the file is going into.
 *
 * `null` means the client expressed no preference and gets the default set.
 * An empty array means the client asked for nothing valid, which callers must
 * refuse rather than serve as an empty file.
 */
export function parseExportColumns(
  raw: string | null,
): readonly ExportColumn[] {
  if (raw === null) return DEFAULT_EXPORT_COLUMNS

  const seen = new Set<ExportColumn>()
  for (const candidate of raw.split(",")) {
    const name = candidate.trim()
    if (isExportColumn(name)) seen.add(name)
  }
  return [...seen]
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
 * `payments-disputed-2026-08-13.csv`. The scope segment is what tells two
 * files apart in a downloads folder a week later, so it is part of the name
 * rather than something ops has to remember.
 *
 * The scope reaches a filename, so it is sanitized here even though callers
 * derive it from an already-allowlisted status.
 */
export function exportFilename(date = new Date(), scope?: string): string {
  const day = date.toISOString().slice(0, 10)
  const label = scope?.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")
  return label
    ? `payments-${label}-${day}.csv`
    : `payments-${day}.csv`
}
