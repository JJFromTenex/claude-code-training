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
 * Ops chooses the columns and the scope. Both arrive from the client, so both
 * are checked here before they reach the query builder or the filename — the
 * disabled Download button in the dialog is a convenience, this is the
 * enforcement.
 */
export function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams

  const columns = parseExportColumns(params.get("columns"))
  if (columns === null) {
    return NextResponse.json(
      { message: "Export columns must be a unique list of known columns." },
      { status: 400 },
    )
  }
  if (columns.length === 0) {
    return NextResponse.json(
      { message: "Select at least one column to export." },
      { status: 400 },
    )
  }

  const scope = parseExportScope(params.get("scope"))
  const filters = parseFilters(params)

  // One query builder either way. "all" keeps the sort and drops the filters
  // ops had on screen, rather than reaching past the builder.
  const scoped =
    scope === "all"
      ? {
          status: "all" as const,
          sort: filters.sort,
          direction: filters.direction,
        }
      : filters

  const rows = sortPayments(
    filterPayments(scoped),
    scoped.sort,
    scoped.direction,
  )

  // Already allowlisted by parseFilters, so nothing raw reaches the filename.
  const label =
    scope === "all"
      ? "all"
      : filters.status && filters.status !== "all"
        ? filters.status
        : undefined

  return new Response(toCsv(rows, columns), {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="${exportFilename(new Date(), label)}"`,
    },
  })
}
