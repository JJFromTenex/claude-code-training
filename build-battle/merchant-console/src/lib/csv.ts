import { merchantById } from "@/data/merchants"
import { Payment, PaymentStatus } from "@/data/types"
import { formatMoney } from "./money"

/**
 * CSV export for the payments table.
 *
 * Ops picks the columns and the scope (NWP-101). Everything a client asks for
 * is checked against the allowlist below before it reaches a header row or a
 * filename — the dialog's own checkboxes are a convenience, never the
 * enforcement.
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
 * What ops gets when they do not choose: every column except the card last
 * four. A file that leaves here for a merchant is clean unless someone asked
 * for it not to be.
 */
export const DEFAULT_EXPORT_COLUMNS: readonly ExportColumn[] =
  EXPORT_COLUMNS.filter((column) => column !== "last4")

export const EXPORT_SCOPES = ["filter", "all"] as const

export type ExportScope = (typeof EXPORT_SCOPES)[number]

function isExportColumn(value: string): value is ExportColumn {
  return (EXPORT_COLUMNS as readonly string[]).includes(value)
}

/**
 * Turn the client's `columns` param into a column list. Unknown names are
 * dropped rather than trusted, duplicates collapse, and the caller's order is
 * kept because it is the order of the file.
 *
 * An absent param means "ops did not choose" and yields the default set. An
 * empty or all-junk param means "ops chose nothing" and yields an empty list,
 * which the route turns into a 400 rather than an empty file.
 */
export function parseExportColumns(
  raw: string | null | undefined,
): ExportColumn[] {
  if (raw === null || raw === undefined) return [...DEFAULT_EXPORT_COLUMNS]

  const chosen: ExportColumn[] = []
  for (const name of raw.split(",")) {
    const trimmed = name.trim()
    if (!isExportColumn(trimmed)) continue
    if (chosen.includes(trimmed)) continue
    chosen.push(trimmed)
  }
  return chosen
}

/** Scope is current filter unless the client explicitly asks for all payments. */
export function parseExportScope(raw: string | null | undefined): ExportScope {
  return raw === "all" ? "all" : "filter"
}

/**
 * The filename's scope segment, derived from filters that have already been
 * validated: `all` for the whole table, the status for a filtered export, and
 * nothing when the filter does not narrow by status.
 */
export function exportScopeLabel(
  scope: ExportScope,
  status?: PaymentStatus | "all",
): string | undefined {
  if (scope === "all") return "all"
  return status && status !== "all" ? status : undefined
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
 * `payments-disputed-2026-08-13.csv`. The label comes from `exportScopeLabel`,
 * never from a raw param, and is scrubbed again here so nothing a client sends
 * can reach a filename.
 */
export function exportFilename(date = new Date(), label?: string): string {
  const segment = label
    ?.toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")

  const parts = segment ? ["payments", segment] : ["payments"]
  parts.push(date.toISOString().slice(0, 10))
  return `${parts.join("-")}.csv`
}
