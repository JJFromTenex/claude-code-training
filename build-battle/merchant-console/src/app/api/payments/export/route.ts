import { filterPayments, parseFilters, sortPayments } from "@/data/queries"
import {
  describeScope,
  ExportScope,
  exportFilename,
  selectColumns,
  toCsv,
} from "@/lib/csv"
import { NextRequest, NextResponse } from "next/server"

/**
 * Exports the payments table as CSV.
 *
 * Ops picks the columns and the scope; both arrive from the client and are
 * checked here before they reach the serializer or the filename. Scope is
 * resolved into filters and run through the same query builder the table
 * uses, so "all payments" cannot drift from what /payments shows.
 */
export function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams

  const selection = selectColumns(params.get("columns"))
  if (!selection.ok) {
    return NextResponse.json({ message: selection.message }, { status: 400 })
  }

  const scope: ExportScope = params.get("scope") === "all" ? "all" : "filter"
  const requested = parseFilters(params)

  // "All payments" is the same query with nothing narrowing it. Ordering is
  // kept so two exports of the same scope come out in the same order.
  const filters =
    scope === "all"
      ? { sort: requested.sort, direction: requested.direction }
      : requested

  const rows = sortPayments(
    filterPayments(filters),
    filters.sort,
    filters.direction,
  )

  return new Response(toCsv(rows, selection.columns), {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="${exportFilename(
        new Date(),
        describeScope(scope, requested),
      )}"`,
    },
  })
}
