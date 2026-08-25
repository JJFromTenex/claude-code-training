import {
  ExportScope,
  filterPayments,
  parseExportOptions,
  parseFilters,
  sortPayments,
} from "@/data/queries"
import { PaymentFilters } from "@/data/types"
import { exportFilename, toCsv } from "@/lib/csv"
import { NextRequest, NextResponse } from "next/server"

/**
 * Exports the payments table as CSV.
 *
 * Columns and scope come from the client and are allowlisted by
 * `parseExportOptions` first. Both scopes go through the one query builder —
 * reading the store directly here would be a second filter path.
 */

/**
 * Names the file after what is in it. Built from validated values only: the
 * scope is one of two literals and the status has already been through
 * `parseFilters`, so nothing a caller typed reaches the filename.
 */
function filenameSegment(
  scope: ExportScope,
  filters: PaymentFilters,
): string | undefined {
  if (scope === "all") return "all"
  if (filters.status && filters.status !== "all") return filters.status
  if (filters.merchantId || filters.search) return "filtered"
  return undefined
}

export function GET(request: NextRequest) {
  const filters = parseFilters(request.nextUrl.searchParams)
  const { columns, scope } = parseExportOptions(request.nextUrl.searchParams)

  if (columns.length === 0) {
    return NextResponse.json(
      { message: "Choose at least one column to export." },
      { status: 400 },
    )
  }

  const matching =
    scope === "all"
      ? filterPayments({ status: "all" })
      : filterPayments(filters)
  const rows = sortPayments(matching, filters.sort, filters.direction)
  const filename = exportFilename(new Date(), filenameSegment(scope, filters))

  return new Response(toCsv(rows, columns), {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="${filename}"`,
    },
  })
}
