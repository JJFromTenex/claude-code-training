import { filterPayments, parseFilters, sortPayments } from "@/data/queries"
import { PaymentFilters } from "@/data/types"
import { exportFilename, parseExportColumns, toCsv } from "@/lib/csv"
import { NextRequest, NextResponse } from "next/server"

type Scope = "current" | "all"

/**
 * The segment that names the file. Built from filters that have already been
 * through parseFilters, so nothing a client typed reaches the filename.
 */
function filenameScope(
  scope: Scope,
  status: PaymentFilters["status"],
): string | undefined {
  if (scope === "all") return "all"
  return status && status !== "all" ? status : undefined
}

/**
 * Exports the payments table as CSV.
 *
 * Ops chooses the columns and the scope (NWP-101). Both arrive from the
 * client, so both are validated here before they reach the query builder or
 * the filename. Filtering stays on the one builder behind GET /api/payments.
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
  const scope: Scope = params.get("scope") === "all" ? "all" : "current"

  // "All payments" drops the filters but keeps the ordering, so it is the
  // same query builder rather than a second path through the store.
  const scoped: PaymentFilters =
    scope === "all"
      ? { sort: filters.sort, direction: filters.direction }
      : filters

  const rows = sortPayments(
    filterPayments(scoped),
    filters.sort,
    filters.direction,
  )

  const filename = exportFilename(
    new Date(),
    filenameScope(scope, filters.status),
  )

  return new Response(toCsv(rows, columns), {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="${filename}"`,
    },
  })
}
