import { merchantById } from "@/data/merchants"
import { Payment, PaymentFilters } from "@/data/types"
import { formatMoney } from "./money"

/**
 * CSV export for the payments table.
 *
 * Ops picks the columns and the scope; everything the client asks for is
 * checked against an allowlist here before it reaches the serializer or the
 * filename. The card last four is opt-in — most of these files go to a
 * merchant, and one that carries it has to be cleaned by hand first.
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

/** Every column but the card last four. Ops opts in to card data, never out. */
export const DEFAULT_EXPORT_COLUMNS: readonly ExportColumn[] = EXPORT_COLUMNS.filter(
  (column) => column !== "last4",
)

const MAX_COLUMN_TOKENS = 64

/**
 * Column names arrive from the client, so they are checked against the
 * allowlist here before they reach the serializer. Unknown names are
 * dropped rather than rejected, following parseFilters' never-throw style —
 * the route decides what an empty result means.
 *
 * Accepts either wire shape (`?columns=id&columns=amount` or a single
 * comma-joined `?columns=id,amount`), matches case-sensitively like every
 * other allowlist in this app, dedupes, and always returns columns in
 * EXPORT_COLUMNS order regardless of the order requested — the client
 * chooses which columns ship, not what order they print in.
 */
export function parseExportColumns(
  raw: readonly string[] | null,
): readonly ExportColumn[] {
  // `URLSearchParams.getAll` returns [], not null, when the param is
  // absent — treat both the same as "nothing requested".
  if (!raw || raw.length === 0) return DEFAULT_EXPORT_COLUMNS

  const tokens = raw
    .flatMap((value) => value.split(","))
    .map((token) => token.trim())
    .filter(Boolean)
    .slice(0, MAX_COLUMN_TOKENS)

  const requested = new Set(tokens)
  return EXPORT_COLUMNS.filter((column) => requested.has(column))
}

export const EXPORT_SCOPES = ["filtered", "all"] as const
export type ExportScope = (typeof EXPORT_SCOPES)[number]

/** Falls back to the safer, narrower scope for anything unrecognized. */
export function parseExportScope(raw: string | null): ExportScope {
  return raw === "all" ? "all" : "filtered"
}

const MAX_SLUG_LENGTH = 32

/**
 * Collapses to a filename-safe ASCII token. This is the only thing standing
 * between client-influenced text and a Content-Disposition header, so it
 * sanitizes here rather than trusting every future caller to have already
 * validated its input.
 */
function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, MAX_SLUG_LENGTH)
    .replace(/^-+|-+$/g, "")
}

/**
 * The filename fragment between "payments" and the date. Scope is checked
 * first: an "all payments" export must never be slugged with a leftover
 * status filter, or the file reads as narrower than it is.
 */
export function exportSlug(
  scope: ExportScope,
  filters: Pick<PaymentFilters, "status">,
): string | null {
  if (scope === "all") return "all"
  if (filters.status && filters.status !== "all") return filters.status
  return null
}

export function exportFilename(date = new Date(), slug?: string | null): string {
  const safeSlug = slug ? slugify(slug) : ""
  const prefix = safeSlug ? `payments-${safeSlug}` : "payments"
  return `${prefix}-${date.toISOString().slice(0, 10)}.csv`
}
