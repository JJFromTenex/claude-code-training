import { filterPayments, parseFilters, sortPayments } from "@/data/queries"
import {
  exportFilename,
  exportLabel,
  parseExportColumns,
  parseExportScope,
  toCsv,
  type ExportScope,
} from "@/lib/csv"
import { NextRequest, NextResponse } from "next/server"

/**
 * Exports the payments table as CSV.
 *
 * Columns and scope arrive from the client and are validated here before
 * they reach a header row or a filename. Filtering always goes through the
 * one query builder.
 */

/**
 * Scope "all" drops the filters but keeps the sort, so the file is ordered
 * the way the table was. Both still go through `parseFilters`, which stays
 * the only thing that validates them.
 */
function filtersForScope(params: URLSearchParams, scope: ExportScope) {
  if (scope === "filtered") return parseFilters(params)

  const sortOnly = new URLSearchParams()
  const sort = params.get("sort")
  const direction = params.get("direction")
  if (sort) sortOnly.set("sort", sort)
  if (direction) sortOnly.set("direction", direction)
  return parseFilters(sortOnly)
}

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
  const filters = filtersForScope(params, scope)
  const rows = sortPayments(
    filterPayments(filters),
    filters.sort,
    filters.direction,
  )

  const filename = exportFilename(exportLabel(scope, filters.status))

  return new Response(toCsv(rows, columns), {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="${filename}"`,
    },
  })
}
