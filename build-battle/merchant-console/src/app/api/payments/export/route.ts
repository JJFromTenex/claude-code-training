import { filterPayments, parseFilters, sortPayments } from "@/data/queries"
import { exportFilename, parseExportColumns, toCsv } from "@/lib/csv"
import { NextRequest, NextResponse } from "next/server"

/**
 * Exports the payments table as CSV.
 *
 * Ops chooses the columns and the scope (NWP-101). Both arrive from the
 * client, so both are checked against an allowlist before they reach the
 * query or the filename. Reuses the one query builder; pagination is
 * deliberately skipped so every matching row exports, not one page.
 */
export function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams

  const columns = parseExportColumns(params.get("columns"))
  if (columns === null) {
    return NextResponse.json(
      { message: "Choose at least one column from the export list." },
      { status: 400 },
    )
  }

  // Unknown scope falls back to the safe default, matching parseFilters.
  const scope = params.get("scope") === "all" ? "all" : "filtered"
  const filters = scope === "all" ? {} : parseFilters(params)
  const rows = sortPayments(
    filterPayments(filters),
    filters.sort,
    filters.direction,
  )

  // Label comes only from allowlisted values: "all", a validated status, or
  // the generic "filtered" — never from raw client input.
  const scopeLabel =
    scope === "all"
      ? "all"
      : filters.status && filters.status !== "all"
        ? filters.status
        : "filtered"

  return new Response(toCsv(rows, columns), {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="${exportFilename(new Date(), scopeLabel)}"`,
    },
  })
}
