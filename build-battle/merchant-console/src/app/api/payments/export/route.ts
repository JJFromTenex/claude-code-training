import { filterPayments, parseFilters, sortPayments } from "@/data/queries"
import {
  exportFilename,
  exportScopeLabel,
  parseExportOptions,
  toCsv,
} from "@/lib/csv"
import { NextRequest, NextResponse } from "next/server"

/**
 * Exports the payments table as CSV (NWP-101).
 *
 * Columns and scope come from the client and are validated by
 * `parseExportOptions` before anything is read. Both scopes go through the
 * one query builder: "filter" honours the active filters, "all" passes none.
 * Every matching row ships, not just the page on screen.
 */
export function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams
  const options = parseExportOptions(params)
  if (!options.ok) {
    return NextResponse.json({ message: options.error }, { status: 400 })
  }

  const filters =
    options.scope === "all"
      ? parseFilters(new URLSearchParams())
      : parseFilters(params)
  const rows = sortPayments(
    filterPayments(filters),
    filters.sort,
    filters.direction,
  )
  const filename = exportFilename(
    new Date(),
    exportScopeLabel(options.scope, filters),
  )

  return new Response(toCsv(rows, options.columns), {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="${filename}"`,
    },
  })
}
