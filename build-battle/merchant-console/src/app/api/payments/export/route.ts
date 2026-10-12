import { filterPayments, parseFilters, sortPayments } from "@/data/queries"
import {
  exportFilename,
  exportLabel,
  isExportScope,
  parseExportColumns,
  toCsv,
} from "@/lib/csv"
import { NextRequest, NextResponse } from "next/server"

/**
 * Exports the payments table as CSV.
 *
 * `columns` is a comma list checked against EXPORT_COLUMNS; absent means the
 * default set, which leaves out last four. `scope` is `current` (the active
 * filters, the default) or `all`. Both scopes go through the one query
 * builder, and neither paginates, so the file is the whole result set.
 */
export function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams

  const scope = params.get("scope") ?? "current"
  if (!isExportScope(scope)) {
    return NextResponse.json(
      { error: "Scope must be current filter or all payments." },
      { status: 400 },
    )
  }

  const columns = parseExportColumns(params.get("columns"))
  if (!columns) {
    return NextResponse.json(
      { error: "Choose at least one column, from the columns listed." },
      { status: 400 },
    )
  }

  const filters = parseFilters(
    scope === "all" ? new URLSearchParams() : params,
  )
  const rows = sortPayments(
    filterPayments(filters),
    filters.sort,
    filters.direction,
  )
  const filename = exportFilename(new Date(), exportLabel(scope, filters))

  return new Response(toCsv(rows, columns), {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="${filename}"`,
    },
  })
}
