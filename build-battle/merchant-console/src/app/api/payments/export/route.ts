import { filterPayments, parseFilters, sortPayments } from "@/data/queries"
import {
  ExportScope,
  exportFilename,
  exportScopeLabel,
  parseExportColumns,
  toCsv,
} from "@/lib/csv"
import { NextRequest, NextResponse } from "next/server"

/**
 * Exports the payments table as CSV.
 *
 * Ops chooses the columns and the scope. Both arrive from the client, so both
 * are validated here before anything touches the query builder or the
 * filename. Export is deliberately unpaginated: the table shows a page, the
 * file is every matching row.
 */
export function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams

  const selection = parseExportColumns(params.get("columns"))
  if (!selection.ok) {
    return NextResponse.json({ message: selection.error }, { status: 400 })
  }

  const scope: ExportScope = params.get("scope") === "all" ? "all" : "filtered"
  const filters = parseFilters(params)

  // Same query builder either way. "All payments" drops the constraints
  // rather than taking a second path through the store.
  const rows = sortPayments(
    filterPayments(scope === "all" ? { status: "all" } : filters),
    filters.sort,
    filters.direction,
  )

  const filename = exportFilename(exportScopeLabel(scope, filters))

  return new Response(toCsv(rows, selection.columns), {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="${filename}"`,
    },
  })
}
