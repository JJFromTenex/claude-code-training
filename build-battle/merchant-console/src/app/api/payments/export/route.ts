import { filterPayments, parseFilters, sortPayments } from "@/data/queries"
import { PaymentFilters } from "@/data/types"
import { exportFilename, parseColumns, toCsv } from "@/lib/csv"
import { NextRequest, NextResponse } from "next/server"

/**
 * Exports the payments table as CSV.
 *
 * `columns` picks which fields ship (validated against the allowlist in
 * parseColumns — never trust column names straight from the client).
 * `scope=all` exports every payment; anything else honors the active
 * filters, same as the on-screen table. Both still go through the one
 * query builder behind GET /api/payments.
 */
export function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams
  const filters = parseFilters(params)
  const scope = params.get("scope") === "all" ? "all" : "current"
  const columns = parseColumns(params.get("columns"))

  if (columns.length === 0) {
    return NextResponse.json(
      { error: "Select at least one column to export." },
      { status: 400 },
    )
  }

  const effectiveFilters: PaymentFilters =
    scope === "all" ? { sort: filters.sort, direction: filters.direction } : filters

  const rows = sortPayments(
    filterPayments(effectiveFilters),
    effectiveFilters.sort,
    effectiveFilters.direction,
  )

  const descriptor =
    scope === "all" ? "all" : filters.status && filters.status !== "all" ? filters.status : undefined

  return new Response(toCsv(rows, columns), {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="${exportFilename(new Date(), descriptor)}"`,
    },
  })
}
