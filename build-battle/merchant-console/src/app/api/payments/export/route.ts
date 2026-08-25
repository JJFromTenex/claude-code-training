import { filterPayments, parseFilters, sortPayments } from "@/data/queries"
import { exportFilename, parseExportColumns, toCsv } from "@/lib/csv"
import { NextRequest, NextResponse } from "next/server"

/**
 * Exports the payments table as CSV.
 *
 * Reuses the one query builder for both scopes: the current filters, or all
 * payments (an empty filter set through the same builder, not a second path).
 * `columns` and `scope` arrive from the client, so both are validated before
 * they reach `toCsv` or the filename.
 */
export function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams
  const filters = parseFilters(params)

  const columns = parseExportColumns(params.get("columns"))
  if (columns.length === 0) {
    return NextResponse.json(
      { message: "Select at least one column to export." },
      { status: 400 },
    )
  }

  const scopeParam = params.get("scope")
  const scope = scopeParam === "all" ? "all" : "filtered"
  const scopeLabel =
    scope === "all"
      ? "all"
      : filters.status && filters.status !== "all"
        ? filters.status
        : "filtered"

  const rows = sortPayments(
    filterPayments(scope === "all" ? {} : filters),
    filters.sort,
    filters.direction,
  )

  return new Response(toCsv(rows, columns), {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="${exportFilename(scopeLabel)}"`,
    },
  })
}
