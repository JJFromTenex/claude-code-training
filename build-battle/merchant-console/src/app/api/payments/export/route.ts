import { filterPayments, parseFilters, sortPayments } from "@/data/queries"
import { exportFilename, parseColumns, toCsv } from "@/lib/csv"
import { NextRequest, NextResponse } from "next/server"

/**
 * Exports the payments table as CSV.
 *
 * Reuses the one query builder. The client chooses the columns and the scope,
 * so both are validated here before they reach the serializer or the filename:
 * columns against the allowlist, scope against its two values.
 */
export function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams

  const columns = parseColumns(params.get("columns"))
  if (columns.length === 0) {
    return NextResponse.json(
      { message: "Select at least one column to export." },
      { status: 400 },
    )
  }

  const scope = params.get("scope") === "all" ? "all" : "current"
  const filters = parseFilters(params)

  // "All payments" clears the filters but keeps the sort, so the file matches
  // the order ops last saw. It still goes through the one builder, not a
  // second filter path.
  const scoped =
    scope === "all"
      ? {
          ...filters,
          status: "all" as const,
          merchantId: undefined,
          search: undefined,
          from: undefined,
          to: undefined,
        }
      : filters

  const rows = sortPayments(
    filterPayments(scoped),
    filters.sort,
    filters.direction,
  )

  const slug =
    scope === "all" ? "all" : filters.status !== "all" ? filters.status : "filtered"

  return new Response(toCsv(rows, columns), {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="${exportFilename(new Date(), slug)}"`,
    },
  })
}
