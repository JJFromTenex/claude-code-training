import { filterPayments, parseFilters, sortPayments } from "@/data/queries"
import { ExportScope, exportFilename, parseExportColumns, toCsv } from "@/lib/csv"
import { NextRequest } from "next/server"

/**
 * Exports the payments table as CSV.
 *
 * Scope and columns are both client input, so both are checked against an
 * allowlist before they reach the query builder or the filename: `scope` can
 * only be "filtered" or "all", and `columns` can only be names from
 * EXPORT_COLUMNS. Reuses the same filterPayments/sortPayments builder that
 * backs GET /api/payments — "all" just means the filter fields never reach it.
 */
export function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams
  const scope: ExportScope = params.get("scope") === "all" ? "all" : "filtered"
  const filters = parseFilters(params)
  const effectiveFilters =
    scope === "all"
      ? { sort: filters.sort, direction: filters.direction }
      : filters

  const columns = parseExportColumns(params.get("columns"))
  if (columns.length === 0) {
    return new Response(
      JSON.stringify({ error: "Select at least one column to export." }),
      { status: 400, headers: { "content-type": "application/json" } },
    )
  }

  const rows = sortPayments(
    filterPayments(effectiveFilters),
    effectiveFilters.sort,
    effectiveFilters.direction,
  )

  return new Response(toCsv(rows, columns), {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="${exportFilename(scope, filters.status)}"`,
    },
  })
}
