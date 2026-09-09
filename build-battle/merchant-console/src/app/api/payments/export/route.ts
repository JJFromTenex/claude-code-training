import { filterPayments, parseFilters, sortPayments } from "@/data/queries"
import { exportFilename, parseExportColumns, toCsv } from "@/lib/csv"
import { NextRequest, NextResponse } from "next/server"

/**
 * Exports the payments table as CSV.
 *
 * Honors the active filters and reuses the query builder, but the column set
 * and the scope are fixed. Giving ops control over both is NWP-101.
 */
export function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams
  const columns = parseExportColumns(params.get("columns"))
  const scope = params.get("scope") ?? "current"

  if (columns === null || columns.length === 0) {
    return NextResponse.json(
      { message: "Choose at least one export column." },
      { status: 400 },
    )
  }

  if (scope !== "current" && scope !== "all") {
    return NextResponse.json({ message: "Invalid export scope." }, { status: 400 })
  }

  const filters = parseFilters(params)
  const exportFilters =
    scope === "all"
      ? {
          ...filters,
          status: "all" as const,
          merchantId: undefined,
          search: undefined,
          from: undefined,
          to: undefined,
          page: 1,
        }
      : filters
  const rows = sortPayments(
    filterPayments(exportFilters),
    exportFilters.sort,
    exportFilters.direction,
  )
  const filenameScope =
    scope === "all"
      ? "all"
      : filters.status && filters.status !== "all"
        ? filters.status
        : "current"

  return new Response(toCsv(rows, columns), {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="${exportFilename(filenameScope)}"`,
    },
  })
}
