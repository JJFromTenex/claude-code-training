import { filterPayments, parseFilters, sortPayments } from "@/data/queries"
import { PaymentFilters } from "@/data/types"
import {
  exportFilename,
  exportSlug,
  parseExportColumns,
  parseExportScope,
  toCsv,
} from "@/lib/csv"
import { NextRequest, NextResponse } from "next/server"

/**
 * Exports the payments table as CSV.
 *
 * Ops chooses the columns and the scope; both are checked against an
 * allowlist here, not trusted from the client. Reuses the query builder
 * behind GET /api/payments rather than reading the store directly, for
 * both the filtered and the "all payments" scope.
 */
export function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams
  const filters = parseFilters(params)
  const scope = parseExportScope(params.get("scope"))
  const columns = parseExportColumns(params.getAll("columns"))

  if (columns.length === 0) {
    return NextResponse.json(
      { message: "Select at least one column to export." },
      { status: 400 },
    )
  }

  // "All payments" still goes through the one query builder — it is the
  // same lookup with the filters cleared, never a read of the store.
  const effective: PaymentFilters =
    scope === "all"
      ? { status: "all", sort: filters.sort, direction: filters.direction }
      : filters

  const rows = sortPayments(
    filterPayments(effective),
    effective.sort,
    effective.direction,
  )

  const filename = exportFilename(new Date(), exportSlug(scope, effective))

  return new Response(toCsv(rows, columns), {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="${filename}"`,
      "x-content-type-options": "nosniff",
      "cache-control": "no-store, private",
    },
  })
}
