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
 * Ops chooses the columns and the scope (NWP-101). Both arrive from the client,
 * so both go through an allowlist before they reach the query builder or the
 * filename. Reuses the builder behind GET /api/payments and deliberately does
 * not paginate: the export is the whole matching set, not the page on screen.
 */
export function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams
  const scope = parseExportScope(params.get("scope"))
  const columns = parseExportColumns(params.get("columns"))

  if (columns.length === 0) {
    return NextResponse.json(
      { message: "Select at least one column to export." },
      { status: 400 },
    )
  }

  // Scope decides which rows; sort is orthogonal and survives either way.
  const requested = parseFilters(params)
  const filters =
    scope === "all"
      ? {
          status: "all" as const,
          sort: requested.sort,
          direction: requested.direction,
        }
      : requested

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
