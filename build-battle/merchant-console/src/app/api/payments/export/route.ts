import { filterPayments, parseFilters, sortPayments } from "@/data/queries"
import { exportFilename, parseExportColumns, toCsv } from "@/lib/csv"
import { NextRequest, NextResponse } from "next/server"

/**
 * Exports the payments table as CSV.
 *
 * Ops picks the columns and the scope (NWP-101). Both arrive from the client,
 * so both are checked here rather than trusted from the dialog: column names
 * must be in the export allowlist, and an unusable list is a 400 rather than a
 * quiet fallback — a file with different columns than were asked for is the
 * exact failure this route exists to prevent. Scope follows the `parseFilters`
 * idiom instead and coerces to the smaller export.
 */
export function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams

  const columns = parseExportColumns(params.get("columns"))
  if (!columns) {
    return NextResponse.json(
      { error: "Select at least one valid column to export." },
      { status: 400 },
    )
  }

  const scope = params.get("scope") === "all" ? "all" : "filter"

  // scope=all still goes through the one query builder, with an empty filter
  // set, so there is never a second filter path. Sort survives either way,
  // because it is what ops sees on screen.
  const requested = parseFilters(params)
  const filters =
    scope === "all"
      ? {
          ...parseFilters(new URLSearchParams()),
          sort: requested.sort,
          direction: requested.direction,
        }
      : requested

  const rows = sortPayments(
    filterPayments(filters),
    filters.sort,
    filters.direction,
  )

  // The label is derived from allowlisted values only — never from raw input.
  const label =
    scope === "all"
      ? "all"
      : requested.status && requested.status !== "all"
        ? requested.status
        : "filtered"

  return new Response(toCsv(rows, columns), {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="${exportFilename(new Date(), label)}"`,
    },
  })
}
