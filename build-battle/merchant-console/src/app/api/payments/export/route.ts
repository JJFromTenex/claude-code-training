import { filterPayments, parseFilters, sortPayments } from "@/data/queries"
import { exportFilename, exportScopeToken, toCsv } from "@/lib/csv"
import { NextRequest } from "next/server"

/**
 * Exports the payments table as CSV.
 *
 * Honors the active filters and reuses the query builder, but the column set
 * and the scope are fixed. Giving ops control over both is NWP-101.
 */
export function GET(request: NextRequest) {
  const filters = parseFilters(request.nextUrl.searchParams)
  const rows = sortPayments(
    filterPayments(filters),
    filters.sort,
    filters.direction,
  )

  return new Response(toCsv(rows), {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="${exportFilename(exportScopeToken("current", filters))}"`,
    },
  })
}
