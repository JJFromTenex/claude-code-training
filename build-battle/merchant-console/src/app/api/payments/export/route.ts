import { filterPayments, parseFilters, sortPayments } from "@/data/queries"
import { PaymentFilters } from "@/data/types"
import {
  exportFilename,
  parseExportColumns,
  parseExportScope,
  toCsv,
} from "@/lib/csv"
import { NextRequest, NextResponse } from "next/server"

/**
 * Exports the payments table as CSV.
 *
 * `columns` picks and orders the columns; `scope` is the current filter or
 * every payment. Both come from the client and both are allowlisted before
 * they touch a query or the filename. Either scope runs through the same
 * query builder, and neither paginates: an export is every matching row.
 */
export function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams

  const parsed = parseExportColumns(params.get("columns"))
  if (!parsed.ok) {
    return NextResponse.json({ message: parsed.message }, { status: 400 })
  }

  const scope = parseExportScope(params.get("scope"))
  const requested = parseFilters(params)
  const filters: PaymentFilters =
    scope === "all"
      ? { sort: requested.sort, direction: requested.direction }
      : requested

  const rows = sortPayments(
    filterPayments(filters),
    filters.sort,
    filters.direction,
  )

  // Both branches are allowlisted values: the scope name, or a parsed status.
  const slug =
    scope === "all"
      ? "all"
      : requested.status && requested.status !== "all"
        ? requested.status
        : "filtered"

  return new Response(toCsv(rows, parsed.columns), {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="${exportFilename(slug)}"`,
    },
  })
}
