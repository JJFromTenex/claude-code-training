import {
  filterPayments,
  parseFilters,
  parseScope,
  scopedFilters,
  sortPayments,
} from "@/data/queries"
import { exportFilename, parseColumns, toCsv } from "@/lib/csv"
import { NextRequest } from "next/server"

/**
 * Exports the payments table as CSV.
 *
 * Ops chooses the column set and the scope (current filter or every
 * payment); both arrive as query params and are validated against an
 * allowlist before they reach the query builder, toCsv, or the filename.
 */
export function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams
  const filters = parseFilters(params)
  const scope = parseScope(params.get("scope"))
  const columns = parseColumns(params.get("columns"))

  const rows = sortPayments(
    filterPayments(scopedFilters(filters, scope)),
    filters.sort,
    filters.direction,
  )

  const label = scope === "all" ? "all" : filters.status !== "all" ? filters.status : undefined

  return new Response(toCsv(rows, columns), {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="${exportFilename(new Date(), label)}"`,
    },
  })
}
