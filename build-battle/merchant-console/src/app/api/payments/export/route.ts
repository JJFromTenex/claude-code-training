import { filterPayments, parseFilters, sortPayments } from "@/data/queries"
import { exportFilename, parseExportColumns, toCsv } from "@/lib/csv"
import { NextRequest, NextResponse } from "next/server"

/**
 * Exports the payments table as CSV.
 *
 * Reuses the query builder behind GET /api/payments. Ops controls which
 * columns come out (`columns`, repeated, allowlisted against EXPORT_COLUMNS)
 * and the scope (`scope=filtered` — the default, honoring the active
 * filters — or `scope=all`, which ignores them).
 */
export function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams

  const columns = parseExportColumns(
    searchParams.has("columns") ? searchParams.getAll("columns") : null,
  )
  if (columns.length === 0) {
    return NextResponse.json(
      { error: "Select at least one column to export." },
      { status: 400 },
    )
  }

  const scope = searchParams.get("scope") === "all" ? "all" : "filtered"
  const filters = parseFilters(searchParams)
  const rows = sortPayments(
    filterPayments(scope === "all" ? {} : filters),
    filters.sort,
    filters.direction,
  )

  const descriptor =
    scope === "all"
      ? "all"
      : filters.status && filters.status !== "all"
        ? filters.status
        : filters.merchantId || filters.search
          ? "filtered"
          : undefined

  return new Response(toCsv(rows, columns), {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="${exportFilename(new Date(), descriptor)}"`,
    },
  })
}
