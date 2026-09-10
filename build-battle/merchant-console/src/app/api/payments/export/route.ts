import { filterPayments, parseFilters, sortPayments } from "@/data/queries"
import {
  exportFilename,
  exportScopeToken,
  parseExportColumns,
  parseExportScope,
  toCsv,
} from "@/lib/csv"
import { NextRequest, NextResponse } from "next/server"

/**
 * Exports the payments table as CSV.
 *
 * Ops chooses the columns and the scope (NWP-101). Both arrive from the
 * client and are checked against an allowlist before anything is built.
 * The rows come from the same query builder as GET /api/payments and are
 * never paginated: the file is the whole set, not the page on screen.
 */
export function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams

  const scope = parseExportScope(params.get("scope"))
  if (!scope.ok) return NextResponse.json({ message: scope.message }, { status: 400 })

  const columns = parseExportColumns(params.get("columns"))
  if (!columns.ok) {
    return NextResponse.json({ message: columns.message }, { status: 400 })
  }

  const parsed = parseFilters(params)
  const filters =
    scope.scope === "all"
      ? { sort: parsed.sort, direction: parsed.direction }
      : parsed
  const rows = sortPayments(
    filterPayments(filters),
    filters.sort,
    filters.direction,
  )
  const filename = exportFilename(exportScopeToken(scope.scope, filters))

  return new Response(toCsv(rows, columns.columns), {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="${filename}"`,
    },
  })
}
