import { filterPayments, parseExportScope, parseFilters, sortPayments } from "@/data/queries"
import { exportFilename, parseExportColumns, toCsv } from "@/lib/csv"
import { NextRequest, NextResponse } from "next/server"

/**
 * Exports the payments table as CSV.
 *
 * NWP-101: ops picks the columns (`columns`, comma-separated — validated
 * against the allowlist in parseExportColumns, never interpolated) and the
 * scope (`scope=all` for every payment, anything else for the current
 * filter). Scope still goes through the one query builder behind
 * GET /api/payments — "all" just means calling it with no filters applied,
 * not a second filter path.
 */
export function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams
  const filters = parseFilters(params)
  const scope = parseExportScope(params.get("scope"))

  const rawColumns = params.has("columns")
    ? params.get("columns")!.split(",").filter(Boolean)
    : null
  const columns = parseExportColumns(rawColumns)

  if (columns.length === 0) {
    return NextResponse.json(
      { error: "Select at least one column." },
      { status: 400 },
    )
  }

  const rows = sortPayments(
    scope === "all" ? filterPayments({ status: "all" }) : filterPayments(filters),
    filters.sort,
    filters.direction,
  )

  const scopeLabel =
    scope === "all" ? "all" : filters.status && filters.status !== "all" ? filters.status : "filtered"

  return new Response(toCsv(rows, columns), {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="${exportFilename(scopeLabel)}"`,
    },
  })
}
