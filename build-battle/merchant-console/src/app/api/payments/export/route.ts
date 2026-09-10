import { describeScope, exportRows, parseFilters, parseScope } from "@/data/queries"
import { exportFilename, parseExportColumns, toCsv } from "@/lib/csv"
import { NextRequest, NextResponse } from "next/server"

/**
 * Exports the payments table as CSV.
 *
 * Ops chooses the columns and the scope (NWP-101). Both arrive from the
 * browser and neither is trusted: columns are checked against the allowlist
 * in `@/lib/csv` and scope against the one in `@/data/queries` before either
 * reaches a row set or a filename. Rows come from the shared query builder,
 * unpaginated, so the file covers the whole scope rather than the page ops
 * happened to be looking at.
 */
export function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams
  const columns = parseExportColumns(params.get("columns"))

  if (columns.length === 0) {
    return NextResponse.json(
      { message: "Select at least one column to export." },
      { status: 400 },
    )
  }

  const filters = parseFilters(params)
  const scope = parseScope(params)
  const rows = exportRows(filters, scope)

  return new Response(toCsv(rows, columns), {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="${exportFilename(
        new Date(),
        describeScope(filters, scope),
      )}"`,
    },
  })
}
