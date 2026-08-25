import { filterPayments, parseFilters, sortPayments } from "@/data/queries"
import { exportFilename, parseExportColumns, toCsv } from "@/lib/csv"
import { NextRequest, NextResponse } from "next/server"

/**
 * Exports the payments table as CSV.
 *
 * Reuses the payment query builder while allowing an allowlisted column set
 * and either the active filters or all payments.
 */
export function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams
  const columns = parseExportColumns(params.get("columns"))

  if (columns === null) {
    return NextResponse.json(
      { message: "Unknown export column" },
      { status: 400 },
    )
  }

  if (columns.length === 0) {
    return NextResponse.json(
      { message: "Select at least one column" },
      { status: 400 },
    )
  }

  const scope = params.get("scope") ?? "filtered"
  if (scope !== "filtered" && scope !== "all") {
    return NextResponse.json(
      { message: "Unknown export scope" },
      { status: 400 },
    )
  }

  const filters = parseFilters(params)
  const rows = sortPayments(
    filterPayments(scope === "all" ? {} : filters),
    filters.sort,
    filters.direction,
  )
  const filenameScope =
    scope === "all"
      ? "all"
      : filters.status && filters.status !== "all"
        ? filters.status
        : "filtered"

  return new Response(toCsv(rows, columns), {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="${exportFilename(new Date(), filenameScope)}"`,
    },
  })
}
