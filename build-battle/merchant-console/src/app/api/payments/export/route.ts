import { filterPayments, parseFilters, sortPayments } from "@/data/queries"
import { exportFilename, parseExportColumns, toCsv } from "@/lib/csv"
import { NextRequest, NextResponse } from "next/server"

/**
 * Exports the payments table as CSV.
 *
 * Reuses the one query builder for both scopes: "current" applies the
 * active filters, "all" calls it with no filters at all rather than
 * reading the store directly.
 */
export function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams
  const scope = params.get("scope") === "all" ? "all" : "current"
  const columns = parseExportColumns(params.get("columns"))

  if (columns.length === 0) {
    return NextResponse.json(
      { error: "Select at least one column to export." },
      { status: 400 },
    )
  }

  const filters = parseFilters(params)
  const rows = sortPayments(
    filterPayments(scope === "all" ? {} : filters),
    filters.sort,
    filters.direction,
  )

  return new Response(toCsv(rows, columns), {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="${exportFilename(scope, filters.status)}"`,
    },
  })
}
