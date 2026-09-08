import { filterPayments, parseFilters, sortPayments } from "@/data/queries"
import {
  exportFilename,
  exportLabel,
  parseExportColumns,
  parseExportScope,
  toCsv,
} from "@/lib/csv"
import { NextRequest, NextResponse } from "next/server"

/**
 * Exports the payments table as CSV.
 *
 * Ops chooses the columns and the scope. Both arrive from the client and are
 * checked against an allowlist before they reach the serializer or the
 * filename. Filtering reuses the query builder and deliberately skips
 * pagination: the file is the whole matching set, never the visible page.
 */
export function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams

  const columns = parseExportColumns(params.get("columns"))
  if (!columns.ok) {
    return NextResponse.json({ message: columns.message }, { status: 400 })
  }

  const scope = parseExportScope(params.get("scope"))
  if (!scope.ok) {
    return NextResponse.json({ message: scope.message }, { status: 400 })
  }

  const filters = parseFilters(params)
  const rows = sortPayments(
    filterPayments(scope.value === "all" ? {} : filters),
    filters.sort,
    filters.direction,
  )
  const filename = exportFilename(
    new Date(),
    exportLabel(scope.value, filters.status),
  )

  return new Response(toCsv(rows, columns.value), {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="${filename}"`,
    },
  })
}
