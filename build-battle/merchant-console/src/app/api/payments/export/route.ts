import { filterPayments, parseFilters, sortPayments } from "@/data/queries"
import { exportFilename, parseColumns, parseScope, toCsv } from "@/lib/csv"
import { NextRequest, NextResponse } from "next/server"

/**
 * Exports the payments table as CSV.
 *
 * `columns` and `scope` are client-supplied and validated against an
 * allowlist before they reach `toCsv` or the filename — never trusted as-is.
 * Scope "all" bypasses the active UI filters entirely and still goes through
 * the one query builder (`filterPayments({})`), not a second filter path.
 */
export function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams
  const filters = parseFilters(params)
  const columns = parseColumns(params.get("columns"))
  const scope = parseScope(params.get("scope"))

  if (columns.length === 0) {
    return NextResponse.json(
      { error: "Select at least one column to export." },
      { status: 400 },
    )
  }

  const rows = sortPayments(
    filterPayments(scope === "all" ? {} : filters),
    filters.sort,
    filters.direction,
  )

  return new Response(toCsv(rows, columns), {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="${exportFilename(scope, filters.status)}"`,
    },
  })
}
