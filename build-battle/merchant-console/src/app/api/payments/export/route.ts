import { filterPayments, parseFilters, sortPayments } from "@/data/queries"
import { exportFilename, parseExportColumns, toCsv } from "@/lib/csv"
import { NextRequest } from "next/server"

/**
 * Exports the payments table as CSV.
 *
 * Ops picks the columns and the scope (NWP-101). Column names come from the
 * client, so they are checked against the allowlist here before anything is
 * written. Scope is either the caller's current filters or every payment; both
 * go through the one query builder.
 */
export function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams

  const columns = parseExportColumns(params.get("columns"))
  if (columns.length === 0) {
    return Response.json(
      { message: "Select at least one column to export." },
      { status: 400 },
    )
  }

  const scope = params.get("scope") === "all" ? "all" : "current"
  const filters = parseFilters(scope === "all" ? new URLSearchParams() : params)

  const rows = sortPayments(
    filterPayments(filters),
    filters.sort,
    filters.direction,
  )

  const label =
    scope === "all"
      ? "all"
      : filters.status !== "all"
        ? filters.status
        : undefined

  return new Response(toCsv(rows, columns), {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="${exportFilename(label)}"`,
    },
  })
}
