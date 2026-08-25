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
 * Ops chooses the columns and the scope; both arrive from the client and both
 * are validated here before they reach the query builder or the filename.
 * Scope `all` ignores the filters but keeps the sort, so the file reads in the
 * same order as the table it came from.
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

  const scope = parseExportScope(params.get("scope"))
  const filters = parseFilters(params)
  const rows = sortPayments(
    filterPayments(scope === "all" ? { status: "all" } : filters),
    filters.sort,
    filters.direction,
  )

  const filename = exportFilename(
    new Date(),
    exportScopeLabel(scope, filters.status),
  )

  return new Response(toCsv(rows, columns), {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="${filename}"`,
    },
  })
}
