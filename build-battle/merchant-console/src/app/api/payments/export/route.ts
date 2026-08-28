import { filterPayments, parseFilters, sortPayments } from "@/data/queries"
import { exportFilename, parseExportColumns, toCsv } from "@/lib/csv"
import { NextRequest, NextResponse } from "next/server"

/**
 * Exports the payments table as CSV.
 *
 * Ops chooses the columns and the scope; both arrive from the client and
 * both are validated here before anything reaches a query or a filename.
 * Scope "all" runs the same query builder with no filters rather than a
 * second path through the store.
 */
export function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams

  const columns = parseExportColumns(params.get("columns"))
  if (columns.length === 0) {
    return NextResponse.json(
      { message: "Select at least one column to export." },
      { status: 400 },
    )
  }

  const scope = params.get("scope") === "all" ? "all" : "filtered"
  const filters = parseFilters(scope === "all" ? new URLSearchParams() : params)

  const rows = sortPayments(
    filterPayments(filters),
    filters.sort,
    filters.direction,
  )

  return new Response(toCsv(rows, columns), {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="${exportFilename(
        scope === "all" ? "all" : (filters.status ?? "all"),
      )}"`,
    },
  })
}
