import { filterPayments, parseFilters, sortPayments } from "@/data/queries"
import {
  exportFilename,
  parseExportColumns,
  parseExportScope,
  toCsv,
} from "@/lib/csv"
import { NextRequest, NextResponse } from "next/server"

/**
 * Exports the payments table as CSV.
 *
 * Ops picks the columns and the scope; both arrive from the browser and both
 * are checked here rather than trusted, because the dialog is a convenience
 * and this is the enforcement.
 */
export function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams
  const filters = parseFilters(params)
  const scope = parseExportScope(params.get("scope"))
  const columns = parseExportColumns(params.get("columns"))

  if (columns.length === 0) {
    return NextResponse.json(
      { message: "Select at least one column to export." },
      { status: 400 },
    )
  }

  // Scope "all" runs the same builder with no filters rather than reaching
  // into the store, so there is still only one way to select payments.
  const scoped = scope === "all"
    ? { sort: filters.sort, direction: filters.direction }
    : filters

  // filterPayments + sortPayments, deliberately not queryPayments: an export
  // is every matching row, and queryPayments paginates. filters.page is left
  // unused for the same reason.
  const rows = sortPayments(
    filterPayments(scoped),
    filters.sort,
    filters.direction,
  )

  // The slug is either a literal or a status parseFilters has already
  // allowlisted — never a string the client chose.
  const slug =
    scope === "all"
      ? "all"
      : filters.status && filters.status !== "all"
        ? filters.status
        : undefined

  return new NextResponse(toCsv(rows, columns), {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="${exportFilename(new Date(), slug)}"`,
    },
  })
}
