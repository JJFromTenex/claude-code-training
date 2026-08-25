import {
  filterPayments,
  parseExportOptions,
  parseFilters,
  sortPayments,
} from "@/data/queries"
import { exportFilename, exportSegment, toCsv } from "@/lib/csv"
import { NextRequest, NextResponse } from "next/server"

/**
 * Exports the payments table as CSV.
 *
 * Ops chooses the columns and the scope (NWP-101). Both arrive from the client
 * and are allowlisted by `parseExportOptions` before they reach the serializer
 * or the filename, so a name the console does not know is dropped rather than
 * echoed. Scope `all` goes back through the same query builder with no filters
 * rather than reading the store directly.
 */
export function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams
  const filters = parseFilters(params)
  const { columns, scope } = parseExportOptions(params)

  if (columns.length === 0) {
    return NextResponse.json(
      { message: "Select at least one column to export." },
      { status: 400 },
    )
  }

  const rows = sortPayments(
    filterPayments(scope === "all" ? {} : filters),
    filters.sort,
    filters.direction,
  )

  const filename = exportFilename(
    new Date(),
    exportSegment(scope, filters.status),
  )

  return new Response(toCsv(rows, columns), {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="${filename}"`,
    },
  })
}
