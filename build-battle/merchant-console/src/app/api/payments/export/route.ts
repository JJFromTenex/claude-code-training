import { filterPayments, parseFilters, sortPayments } from "@/data/queries"
import { exportFilename, parseExportOptions, toCsv } from "@/lib/csv"
import { NextRequest, NextResponse } from "next/server"

/**
 * Exports the payments table as CSV.
 *
 * Columns and scope arrive from the export dialog (NWP-101) and are
 * validated server-side by parseExportOptions. Filtering still goes
 * through the one query builder; `scope=all` runs it without the filters
 * rather than through a second path. Pagination is skipped on purpose so
 * the file covers the whole set, not the visible page.
 */
export function GET(request: NextRequest) {
  const { columns, scope } = parseExportOptions(request.nextUrl.searchParams)
  if (!columns) {
    return NextResponse.json(
      { message: "Select at least one column to export." },
      { status: 400 },
    )
  }

  const filters = parseFilters(request.nextUrl.searchParams)
  const scoped =
    scope === "all"
      ? { sort: filters.sort, direction: filters.direction }
      : filters
  const rows = sortPayments(filterPayments(scoped), scoped.sort, scoped.direction)

  const descriptor =
    scope === "all" ? "all" : filters.status !== "all" ? filters.status : undefined

  return new Response(toCsv(rows, columns), {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="${exportFilename(new Date(), descriptor)}"`,
    },
  })
}
