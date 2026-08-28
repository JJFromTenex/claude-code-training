import { merchantById } from "@/data/merchants"
import { Payment } from "@/data/types"
import { formatMoney } from "./money"

/**
 * CSV export for the payments table.
 *
 * Ops chooses the column set per export (NWP-101). `EXPORT_COLUMNS` is the
 * allowlist of everything that may appear; `DEFAULT_EXPORT_COLUMNS` is what
 * ships when nobody chooses. Card last four is in the first and not the
 * second, so a file only carries it when someone asked for it on purpose.
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
 * What an export contains when the caller does not pick columns.
 *
 * Every column except the card last four. Ops hand-edited that out of files
 * bound for merchants, which is the manual step NWP-101 removes; opting in is
 * a deliberate act, opting out is not something anyone should have to remember.
 */
export const DEFAULT_EXPORT_COLUMNS: readonly ExportColumn[] =
  EXPORT_COLUMNS.filter((column) => column !== "last4")

/**
 * Turn the client's `columns` parameter into a validated column list.
 *
 * Column names arrive from the browser, so they are checked against
 * `EXPORT_COLUMNS` before they reach a header row or a filename — never
 * trusted, never interpolated. Order is the caller's, so ops gets the file
 * laid out the way they asked for it.
 *
 * @param raw The raw `columns` query parameter, or null when absent.
 * @returns The default set when the parameter is absent; otherwise the valid
 *   requested columns, deduped and in the requested order. An empty array
 *   means nothing valid was requested — callers reject rather than writing a
 *   headerless file.
 */
export function parseExportColumns(raw: string | null): ExportColumn[] {
  if (raw === null) return [...DEFAULT_EXPORT_COLUMNS]

  const allowed = new Set<string>(EXPORT_COLUMNS)
  const seen = new Set<string>()

  return raw
    .split(",")
    .map((name) => name.trim())
    .filter((name) => {
      if (!allowed.has(name) || seen.has(name)) return false
      seen.add(name)
      return true
    }) as ExportColumn[]
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
 * Name the downloaded file after what is in it.
 *
 * Ops runs several exports a day and they land in one downloads folder, so the
 * scope belongs in the name: `payments-disputed-2026-03-14.csv` rather than a
 * second `payments-2026-03-14.csv` nobody can tell apart.
 *
 * @param date Stamped as a UTC calendar day, matching how the store buckets.
 * @param scopeLabel Optional description of what was exported. Sanitised to
 *   `[a-z0-9-]` — it only ever reaches here from an allowlist, but a filename
 *   is not a place to rely on that.
 * @returns `payments-<scope>-<date>.csv`, or `payments-<date>.csv` when no
 *   scope is given, which is what callers predating NWP-101 still get.
 */
export function exportFilename(date = new Date(), scopeLabel?: string): string {
  const day = date.toISOString().slice(0, 10)
  const scope = scopeLabel
    ?.toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")

  return scope ? `payments-${scope}-${day}.csv` : `payments-${day}.csv`
}
