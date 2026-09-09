import { merchantById } from "@/data/merchants"
import { Payment, PaymentFilters } from "@/data/types"
import { formatMoney } from "./money"

/**
 * CSV export for the payments table.
 *
 * Ops chooses which columns ship and whether the file covers the current
 * filter or every payment (NWP-101). Both choices arrive from the client, so
 * they are checked against an allowlist here before they reach the
 * serializer or the filename.
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
 * What ships when nobody chooses. Card last-four is off on purpose: most
 * exports go to a merchant, and the last four is the field ops was hand-
 * deleting before this ticket.
 */
export const DEFAULT_EXPORT_COLUMNS: readonly ExportColumn[] =
  EXPORT_COLUMNS.filter((column) => column !== "last4")

export const EXPORT_SCOPES = ["filtered", "all"] as const

export type ExportScope = (typeof EXPORT_SCOPES)[number]

function isExportColumn(value: string): value is ExportColumn {
  return (EXPORT_COLUMNS as readonly string[]).includes(value)
}

/**
 * Parse the `columns` query param. Absent means the default set; present
 * means exactly the allowlisted names given, in the order given, deduped.
 * An empty or all-unknown list yields `[]` — the caller decides what an
 * empty selection means, and it is never an empty file.
 */
export function parseExportColumns(raw: string | null): ExportColumn[] {
  if (raw === null) return [...DEFAULT_EXPORT_COLUMNS]

  const seen = new Set<ExportColumn>()
  for (const part of raw.split(",")) {
    const name = part.trim()
    if (isExportColumn(name)) seen.add(name)
  }
  return [...seen]
}

/** Parse the `scope` query param. Anything unrecognised is the safe default. */
export function parseExportScope(raw: string | null): ExportScope {
  return (EXPORT_SCOPES as readonly string[]).includes(raw ?? "")
    ? (raw as ExportScope)
    : "filtered"
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
 * `payments-{segment}-{YYYY-MM-DD}.csv`, where the segment says what is in
 * the file: `all`, the status filter (`disputed`), or `filtered` when the
 * current filter has no status. Both inputs are already allowlisted —
 * `scope` above, `status` by `parseFilters` — so nothing raw reaches a
 * filename.
 */
export function exportFilename(
  scope: ExportScope,
  filters: Pick<PaymentFilters, "status">,
  date = new Date(),
): string {
  const segment =
    scope === "all"
      ? "all"
      : filters.status && filters.status !== "all"
        ? filters.status
        : "filtered"
  return `payments-${segment}-${date.toISOString().slice(0, 10)}.csv`
}
