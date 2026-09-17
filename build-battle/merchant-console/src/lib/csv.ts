import { merchantById } from "@/data/merchants"
import { Payment } from "@/data/types"
import { formatMoney } from "./money"

/**
 * CSV export for the payments table.
 *
 * The column set is fixed. Ops has asked for control over it — that is
 * NWP-101 — but today everyone gets every column, including the card
 * last four, whether or not the file is going to a merchant.
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

export const DEFAULT_EXPORT_COLUMNS: readonly ExportColumn[] = EXPORT_COLUMNS.filter(
  (column) => column !== "last4",
)

export const EXPORT_SCOPES = ["current", "all"] as const
export type ExportScope = (typeof EXPORT_SCOPES)[number]

export function parseExportScope(raw: string | null): ExportScope {
  return raw === "all" ? "all" : "current"
}

export function parseExportColumns(raw: string | null): ExportColumn[] {
  if (!raw) return []
  const isExportColumn = (value: string): value is ExportColumn =>
    (EXPORT_COLUMNS as readonly string[]).includes(value)
  const seen = new Set<ExportColumn>()
  for (const part of raw.split(",")) {
    const trimmed = part.trim()
    if (isExportColumn(trimmed)) seen.add(trimmed)
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

export function exportFilename(date = new Date(), label?: string): string {
  const stamp = date.toISOString().slice(0, 10)
  const safeLabel = label && /^[a-z_]+$/.test(label) ? label : undefined
  return safeLabel ? `payments-${safeLabel}-${stamp}.csv` : `payments-${stamp}.csv`
}

export function buildExportHref(
  query: string,
  scope: ExportScope,
  columns: readonly ExportColumn[],
): string {
  const params =
    scope === "all" ? new URLSearchParams() : new URLSearchParams(query)
  params.delete("page")
  params.delete("scope")
  params.delete("columns")
  params.set("scope", scope)
  params.set("columns", columns.join(","))
  return `/api/payments/export?${params.toString()}`
}
