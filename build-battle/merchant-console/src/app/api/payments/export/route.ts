import { filterPayments, parseFilters, sortPayments } from "@/data/queries"
import { exportFilename, parseExportColumns, toCsv } from "@/lib/csv"
import { NextRequest, NextResponse } from "next/server"

/**
 * Exports the payments table as CSV.
 *
 * `columns` picks the subset (and order) to include, validated against the
 * `EXPORT_COLUMNS` allowlist; an absent param means every column. `scope`
 * is `"current"` (default, honors the active filters) or `"all"` (ignores
 * them, still through the one query builder).
 */
export function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams
  const rawColumns = params.get("columns")
  const columns = parseExportColumns(rawColumns)

  if (rawColumns !== null && columns.length === 0) {
    return NextResponse.json(
      { error: "No valid columns requested" },
      { status: 400 },
    )
  }

  const scope = params.get("scope") === "all" ? "all" : "current"
  const parsedFilters = parseFilters(params)
  const effectiveFilters = scope === "all" ? {} : parsedFilters

  const rows = sortPayments(
    filterPayments(effectiveFilters),
    parsedFilters.sort,
    parsedFilters.direction,
  )

  const label =
    scope === "all"
      ? "all"
      : parsedFilters.status !== "all"
        ? parsedFilters.status
        : undefined

  return new Response(toCsv(rows, columns), {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="${exportFilename(new Date(), label)}"`,
    },
  })
}
