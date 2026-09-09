import { filterPayments, parseFilters, sortPayments } from "@/data/queries"
import { exportFilename, parseExportColumns, toCsv } from "@/lib/csv"
import { NextRequest, NextResponse } from "next/server"

/**
 * Exports the payments table as CSV.
 *
 * NWP-101: ops picks the scope (`scope=filtered` for the active filters,
 * `scope=all` for every payment) and the column set (`columns=id,amount`,
 * validated server-side against `EXPORT_COLUMNS`). Both filtering and
 * sorting go through the one query builder behind `GET /api/payments`.
 */
export function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams
  const filters = parseFilters(params)
  const scope = params.get("scope") === "all" ? "all" : "filtered"
  const columns = parseExportColumns(params.get("columns"))

  if (columns.length === 0) {
    return NextResponse.json(
      { message: "Select at least one column." },
      { status: 400 },
    )
  }

  const rows =
    scope === "all"
      ? sortPayments(filterPayments({}), filters.sort, filters.direction)
      : sortPayments(
          filterPayments(filters),
          filters.sort,
          filters.direction,
        )

  const scopeLabel =
    scope === "all"
      ? "all"
      : filters.status && filters.status !== "all"
        ? filters.status
        : "filtered"

  return new Response(toCsv(rows, columns), {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="${exportFilename(scopeLabel)}"`,
    },
  })
}
