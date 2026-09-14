import { filterPayments, parseFilters, sortPayments } from "@/data/queries"
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
 * Ops picks the columns and the scope (NWP-101). Both come from the client and
 * both are allowlisted before they touch the header row or the filename.
 * Filtering reuses the query builder and deliberately skips pagination: the
 * file is the whole result, not the page on screen.
 */
export function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams

  const columns = parseExportColumns(params)
  if (!columns) {
    return NextResponse.json(
      { message: "Choose at least one known column to export." },
      { status: 400 },
    )
  }

  const scope = parseExportScope(params)
  if (!scope) {
    return NextResponse.json(
      { message: "Export scope must be 'filter' or 'all'." },
      { status: 400 },
    )
  }

  // Scope "all" keeps the caller's sort but drops every filter.
  const requested = parseFilters(params)
  const filters =
    scope === "all"
      ? { sort: requested.sort, direction: requested.direction }
      : requested
  const rows = sortPayments(
    filterPayments(filters),
    filters.sort,
    filters.direction,
  )

  return new Response(toCsv(rows, columns), {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="${exportFilename(scope, requested.status)}"`,
    },
  })
}
