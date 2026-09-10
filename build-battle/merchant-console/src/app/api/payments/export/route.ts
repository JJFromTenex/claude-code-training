import { filterPayments, parseFilters, sortPayments } from "@/data/queries"
import {
  DEFAULT_EXPORT_COLUMNS,
  exportFilename,
  parseColumns,
  toCsv,
} from "@/lib/csv"
import { NextRequest } from "next/server"

/**
 * Exports the payments table as CSV (NWP-101).
 *
 * Ops chooses the columns and the scope. Both arrive from the client, so both
 * are validated here: column names against the EXPORT_COLUMNS allowlist, scope
 * to a known value. Filtering reuses the one query builder — the export is
 * unbounded (no pagination) by design.
 */
export function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams

  // Columns: absent → the default set (last-four off). Present but empty after
  // validation → the client sent an empty selection; refuse rather than write
  // a header-only file.
  const columns = params.has("columns")
    ? parseColumns(params.get("columns"))
    : DEFAULT_EXPORT_COLUMNS
  if (columns.length === 0) {
    return Response.json(
      { message: "Select at least one column to export." },
      { status: 400 },
    )
  }

  // Scope: "all" exports every payment; anything else is the current filter.
  const scope = params.get("scope") === "all" ? "all" : "current"
  const filters = parseFilters(params)
  const matched =
    scope === "all" ? filterPayments({ status: "all" }) : filterPayments(filters)
  const rows = sortPayments(matched, filters.sort, filters.direction)

  const scopeLabel =
    scope === "all"
      ? "all"
      : filters.status === "all"
        ? undefined
        : filters.status

  return new Response(toCsv(rows, columns), {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="${exportFilename(scopeLabel)}"`,
    },
  })
}
