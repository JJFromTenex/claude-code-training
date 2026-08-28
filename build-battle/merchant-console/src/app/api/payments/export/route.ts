import { filterPayments, parseFilters, sortPayments } from "@/data/queries"
import { PaymentFilters } from "@/data/types"
import { exportFilename, parseExportColumns, toCsv } from "@/lib/csv"
import { NextRequest, NextResponse } from "next/server"

/** Names the slice of payments a file covers, for its filename. */
function scopeLabel(filters: PaymentFilters, wholeStore: boolean): string {
  if (wholeStore) return "all"
  if (filters.status && filters.status !== "all") return filters.status
  return "filtered"
}

/**
 * Exports the payments table as CSV.
 *
 * The column set and the scope come from the client and are checked here
 * before either reaches a row or a filename. Filtering runs through the one
 * query builder but stops short of paginate(): the file covers every matching
 * payment, not the page the table happens to be showing.
 */
export function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams

  const columns = parseExportColumns(params.get("columns"))
  if (columns.length === 0) {
    return NextResponse.json(
      { message: "Choose at least one column to export." },
      { status: 400 },
    )
  }

  const filters = parseFilters(params)
  const wholeStore = params.get("scope") === "all"
  // Scope decides which rows, never their order, so the sort survives both.
  const selected: PaymentFilters = wholeStore
    ? { status: "all", sort: filters.sort, direction: filters.direction }
    : filters

  const rows = sortPayments(
    filterPayments(selected),
    selected.sort,
    selected.direction,
  )

  return new Response(toCsv(rows, columns), {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="${exportFilename(
        new Date(),
        scopeLabel(filters, wholeStore),
      )}"`,
    },
  })
}
