import { filterPayments, parseFilters, sortPayments } from "@/data/queries"
import {
  DEFAULT_COLUMNS,
  exportFilename,
  parseColumns,
  toCsv,
} from "@/lib/csv"
import { NextRequest, NextResponse } from "next/server"

/**
 * Exports the payments table as CSV.
 *
 * Ops picks the columns (last4 off by default) and the scope. Column names
 * arrive from the client, so they are checked against an allowlist before
 * they reach the query, the filename, or the CSV writer.
 */
export function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams

  const rawColumns = params.get("columns")
  const columns =
    rawColumns === null ? DEFAULT_COLUMNS : parseColumns(rawColumns)
  if (columns === null) {
    return NextResponse.json(
      { message: "Unknown or empty column selection" },
      { status: 400 },
    )
  }

  const scope: "filtered" | "all" =
    params.get("scope") === "all" ? "all" : "filtered"

  const filters = parseFilters(params)
  const rows = scope === "all" ? filterPayments({}) : filterPayments(filters)
  const sorted = sortPayments(rows, filters.sort, filters.direction)

  const filenameStatus =
    scope === "all" || filters.status === "all" ? undefined : filters.status

  return new Response(toCsv(sorted, columns), {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="${exportFilename(new Date(), { status: filenameStatus, scope })}"`,
    },
  })
}
