import { filterPayments, parseFilters, sortPayments } from "@/data/queries"
import {
  DEFAULT_EXPORT_COLUMNS,
  exportFilename,
  parseExportColumns,
  parseExportScope,
  toCsv,
} from "@/lib/csv"
import { NextRequest, NextResponse } from "next/server"

/** Exports payments as CSV. Scope and columns are allowlisted before use. */
export function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams
  const scope = parseExportScope(params.get("scope"))

  const filters = parseFilters(
    scope === "all" ? new URLSearchParams() : params,
  )
  const rows = sortPayments(
    filterPayments(filters),
    filters.sort,
    filters.direction,
  )

  const columnsParam = params.get("columns")
  const columns = columnsParam === null
    ? DEFAULT_EXPORT_COLUMNS
    : parseExportColumns(columnsParam)

  if (columns.length === 0) {
    return NextResponse.json(
      { message: "Choose at least one valid column to export." },
      { status: 400 },
    )
  }

  const label =
    scope === "all"
      ? "all"
      : filters.status !== "all"
        ? filters.status
        : undefined

  return new Response(toCsv(rows, columns), {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="${exportFilename(new Date(), label)}"`,
    },
  })
}
