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
 * Columns and scope come from the client and are allowlisted in `@/lib/csv`
 * before they touch the serializer or the filename. Row selection happens
 * here, through the same query builder as `GET /api/payments`, and never
 * paginates: the table shows twenty rows, the file holds every match.
 */
export function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams
  const filters = parseFilters(params)
  const columns = parseExportColumns(params.get("columns"))
  const scope = parseExportScope(params.get("scope"))

  if (columns.length === 0) {
    return NextResponse.json(
      { message: "Choose at least one column to export." },
      { status: 400 },
    )
  }

  // "All payments" is the same builder with neutral filters, not a second path.
  const selection =
    scope === "all"
      ? { sort: filters.sort, direction: filters.direction }
      : filters
  const rows = sortPayments(
    filterPayments(selection),
    filters.sort,
    filters.direction,
  )

  return new Response(toCsv(rows, columns), {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="${exportFilename(scope, filters)}"`,
    },
  })
}
