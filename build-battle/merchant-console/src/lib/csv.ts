import { merchantById } from "@/data/merchants"
import { Payment } from "@/data/types"
import { formatMoneyPlain } from "./money"

/**
 * CSV export for the payments table.
 *
 * `EXPORT_COLUMNS` is the allowlist: every column ops is allowed to ask for.
 * `DEFAULT_EXPORT_COLUMNS` is what they get when they ask for nothing in
 * particular, and it deliberately leaves out the card last four — an export
 * bound for a merchant should not carry it unless someone chose it.
 *
 * Column names arrive from the client, so `validateExportColumns` is the only
 * way a request should reach `toCsv`.
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

/** What an export contains when ops picks no columns. No card last four. */
export const DEFAULT_EXPORT_COLUMNS: readonly ExportColumn[] =
  EXPORT_COLUMNS.filter((column) => column !== "last4")

/**
 * Narrow client-supplied column names to the allowlist.
 *
 * Unknown names are dropped rather than rejected, and the caller's order is
 * kept so ops gets the column order they asked for. An empty result means
 * "nothing valid was requested" and is the caller's problem to report — the
 * route turns it into a 400 rather than writing a headerless file.
 */
export function validateExportColumns(
  requested: readonly string[],
): ExportColumn[] {
  return requested.filter((name): name is ExportColumn =>
    (EXPORT_COLUMNS as readonly string[]).includes(name),
  )
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
      return formatMoneyPlain(payment.amount)
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
 * `payments-disputed-2026-08-13.csv`.
 *
 * The scope segment is slugged here as well as allowlisted upstream: a
 * filename is one of the three places `.claude/rules/api-routes.md` names, and
 * this way the guarantee does not depend on every caller remembering it.
 */
export function exportFilename(date = new Date(), scope?: string): string {
  const slug = scope?.toLowerCase().replace(/[^a-z0-9-]/g, "")
  const segment = slug ? `-${slug}` : ""
  return `payments${segment}-${date.toISOString().slice(0, 10)}.csv`
}
