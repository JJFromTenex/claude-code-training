import { filterPayments, parseFilters, sortPayments } from "@/data/queries"
import {
  exportFilename,
  parseExportColumns,
  parseExportScope,
  toCsv,
} from "@/lib/csv"
import { NextRequest, NextResponse } from "next/server"

/**
 * Exports the payments table as CSV.
 *
 * Columns and scope arrive from the client and are resolved against the
 * allowlist in `lib/csv` before they reach the query, the file, or the
 * filename. Scope "all" drops the filters but still goes through the one
 * query builder, and nothing here paginates: the file is the whole result
 * set, never the page ops happens to be looking at.
 */
export function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams
  const filters = parseFilters(params)
  const scope = parseExportScope(params)
  const columns = parseExportColumns(params)

  if (!columns) {
    return NextResponse.json(
      { message: "Pick at least one column to export." },
      { status: 400 },
    )
  }

  const scoped =
    scope === "all"
      ? {
          status: "all" as const,
          sort: filters.sort,
          direction: filters.direction,
        }
      : filters

  const rows = sortPayments(
    filterPayments(scoped),
    filters.sort,
    filters.direction,
  )

  return new Response(toCsv(rows, columns), {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="${exportFilename(
        new Date(),
        scope,
        filters.status,
      )}"`,
    },
  })
}
