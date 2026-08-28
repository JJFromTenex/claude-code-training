import { filterPayments, parseFilters, sortPayments } from "@/data/queries"
import { PaymentFilters } from "@/data/types"
import {
  exportFilename,
  exportScopeSegment,
  parseExportColumns,
  parseExportScope,
  toCsv,
} from "@/lib/csv"
import { NextRequest, NextResponse } from "next/server"

/**
 * Exports the payments table as CSV.
 *
 * Columns and scope both arrive from the client, so both are allowlisted here.
 * The dialog on /payments is the convenience; this is the enforcement.
 *
 * The export is deliberately never paginated: it is the whole result set for
 * the chosen scope, not the page the table happens to be showing.
 */
export function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams

  const columns = parseExportColumns(params)
  if (columns.length === 0) {
    return NextResponse.json(
      { message: "Select at least one column to export." },
      { status: 400 },
    )
  }

  const scope = parseExportScope(params)
  const requested = parseFilters(params)

  // "All payments" goes through the same builder with the filters neutralized
  // rather than reading the store directly. Sort and direction survive so the
  // file comes out in the order the user was looking at.
  const filters: PaymentFilters =
    scope === "all"
      ? { status: "all", sort: requested.sort, direction: requested.direction }
      : requested

  const rows = sortPayments(
    filterPayments(filters),
    filters.sort,
    filters.direction,
  )

  const filename = exportFilename(
    new Date(),
    exportScopeSegment(scope, requested),
  )

  return new Response(toCsv(rows, columns), {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="${filename}"`,
    },
  })
}
