import { filterPayments, parseFilters, sortPayments } from "@/data/queries"
import {
  exportFilename,
  exportSegment,
  parseExportColumns,
  parseExportScope,
  toCsv,
} from "@/lib/csv"
import { NextRequest, NextResponse } from "next/server"

/**
 * Exports the payments table as CSV.
 *
 * Columns and scope arrive from the export dialog and are allowlisted in
 * `@/lib/csv` before they reach the serializer or the filename. The rows are
 * never paginated here: the whole point is that ops gets the full result set
 * rather than whichever page the table happens to be showing.
 */
export function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams
  const filters = parseFilters(params)
  const columns = parseExportColumns(params.get("columns"))
  const scope = parseExportScope(params.get("scope"))

  if (columns.length === 0) {
    return NextResponse.json(
      { message: "Pick at least one column to export." },
      { status: 400 },
    )
  }

  // "All payments" is the same query builder with the filters left empty, not
  // a second filter path. Ordering follows the table either way.
  const scoped =
    scope === "all" ? filterPayments({ status: "all" }) : filterPayments(filters)
  const rows = sortPayments(scoped, filters.sort, filters.direction)
  const filename = exportFilename(exportSegment(scope, filters.status))

  return new Response(toCsv(rows, columns), {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="${filename}"`,
    },
  })
}
