import { filterPayments, parseFilters, sortPayments } from "@/data/queries"
import {
  exportFilename,
  parseExportColumns,
  parseExportScope,
  toCsv,
} from "@/lib/csv"
import { NextRequest, NextResponse } from "next/server"
import { PaymentFilters } from "@/data/types"

/**
 * Exports the payments table as CSV.
 *
 * Ops picks the columns and the scope (NWP-101). Both arrive from the client,
 * so both are allowlisted before they reach the query builder or the filename.
 * The export never paginates: the file covers every matching row, not the page
 * the table happens to be showing.
 */
export function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams

  const parsed = parseExportColumns(params.get("columns"))
  if ("error" in parsed) {
    return NextResponse.json({ message: parsed.error }, { status: 400 })
  }

  const scope = parseExportScope(params.get("scope"))
  const filters = parseFilters(params)

  // "all" drops the filters and keeps the sort, so the file is still ordered
  // the way ops was reading the table.
  const applied: PaymentFilters =
    scope === "all"
      ? { status: "all", sort: filters.sort, direction: filters.direction }
      : filters

  const rows = sortPayments(
    filterPayments(applied),
    applied.sort,
    applied.direction,
  )

  // "payments-disputed-2026-08-13.csv" when a status is filtered, so the file
  // says what it covers without being opened.
  const slug =
    scope === "all"
      ? "all"
      : filters.status && filters.status !== "all"
        ? filters.status
        : "filtered"

  return new Response(toCsv(rows, parsed.columns), {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="${exportFilename(new Date(), slug)}"`,
    },
  })
}
