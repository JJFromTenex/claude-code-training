import { filterPayments, parseFilters, sortPayments } from "@/data/queries"
import { exportFilename, parseExportColumns, toCsv } from "@/lib/csv"
import { NextRequest, NextResponse } from "next/server"

/**
 * Exports the payments table as CSV.
 *
 * Ops chooses the columns (`columns`, comma-separated, validated against
 * the allowlist in `src/lib/csv.ts`) and the scope (`scope=filter` honors
 * the active filters and is the default; `scope=all` exports everything).
 * Both scopes run through the one query builder; neither is paginated, so
 * the file always holds the full matching set rather than the visible page.
 */
export function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams

  const columns = parseExportColumns(params.get("columns"))
  if (columns === null) {
    return NextResponse.json(
      { message: "Unknown or empty column selection." },
      { status: 400 },
    )
  }

  const scope = params.get("scope") === "all" ? "all" : "filter"
  const filters = parseFilters(
    scope === "all" ? new URLSearchParams() : params,
  )
  const rows = sortPayments(
    filterPayments(filters),
    filters.sort,
    filters.direction,
  )

  // Scope token for the filename: allowlisted values only. `parseFilters`
  // already reduced status to a known value, so nothing client-supplied
  // reaches the header verbatim.
  const scopeToken =
    scope === "all"
      ? "all"
      : filters.status && filters.status !== "all"
        ? filters.status
        : "filtered"

  return new Response(toCsv(rows, columns), {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="${exportFilename(scopeToken)}"`,
    },
  })
}
