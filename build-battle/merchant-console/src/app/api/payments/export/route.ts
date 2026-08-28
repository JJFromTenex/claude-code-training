import { filterPayments, parseFilters, sortPayments } from "@/data/queries"
import {
  exportFilename,
  exportScopeLabel,
  parseExportColumns,
  parseExportScope,
  toCsv,
} from "@/lib/csv"
import { NextRequest, NextResponse } from "next/server"

/**
 * Exports the payments table as CSV.
 *
 * Ops chooses the columns and the scope (NWP-101). Both are parsed against
 * an allowlist before they touch anything, and the rows still come from
 * the one query builder — never paginated, so the file is every matching
 * payment rather than the page on screen.
 */
export function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams

  const columns = parseExportColumns(params.get("columns"))
  if (columns.length === 0) {
    return NextResponse.json(
      { error: "Select at least one column to export." },
      { status: 400 },
    )
  }

  // "All payments" keeps the sort and drops every filter. Re-parsing a
  // reduced param set keeps the allowlist in one place and means a filter
  // added to PaymentFilters later cannot leak into the all-payments file.
  const scope = parseExportScope(params.get("scope"))
  const unfiltered = new URLSearchParams()
  for (const key of ["sort", "direction"]) {
    const value = params.get(key)
    if (value !== null) unfiltered.set(key, value)
  }
  const filters = parseFilters(scope === "all" ? unfiltered : params)

  const rows = sortPayments(
    filterPayments(filters),
    filters.sort,
    filters.direction,
  )
  const filename = exportFilename(new Date(), exportScopeLabel(scope, filters))

  return new Response(toCsv(rows, columns), {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="${filename}"`,
    },
  })
}
