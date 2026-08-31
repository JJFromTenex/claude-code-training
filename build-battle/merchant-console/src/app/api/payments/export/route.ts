import { filterPayments, parseFilters, sortPayments } from "@/data/queries"
import { exportFilename, parseExportColumns, toCsv } from "@/lib/csv"
import { NextRequest, NextResponse } from "next/server"

const SCOPES = ["current", "all"] as const
type ExportScope = (typeof SCOPES)[number]

/**
 * Exports the payments table as CSV.
 *
 * `columns` (comma-separated) and `scope` (current | all) arrive from the
 * client and are validated against allowlists before they reach the query
 * or the filename. Scope "current" honors the active filters; "all" runs
 * the same query builder with no filters.
 */
export function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams

  const scopeParam = params.get("scope") ?? "current"
  if (!SCOPES.includes(scopeParam as ExportScope)) {
    return NextResponse.json(
      { error: 'Scope must be "current" or "all".' },
      { status: 400 },
    )
  }
  const scope = scopeParam as ExportScope

  const columns = parseExportColumns(params.get("columns"))
  if (!columns) {
    return NextResponse.json(
      { error: "Unknown or empty column selection." },
      { status: 400 },
    )
  }

  const filters =
    scope === "all" ? parseFilters(new URLSearchParams()) : parseFilters(params)
  const rows = sortPayments(
    filterPayments(filters),
    filters.sort,
    filters.direction,
  )

  const slug =
    scope === "all"
      ? "all"
      : filters.status && filters.status !== "all"
        ? filters.status
        : "filtered"

  return new Response(toCsv(rows, columns), {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="${exportFilename(new Date(), slug)}"`,
    },
  })
}
