import { filterPayments, parseFilters, sortPayments } from "@/data/queries"
import {
  DEFAULT_EXPORT_COLUMNS,
  exportFilename,
  parseColumns,
  toCsv,
} from "@/lib/csv"
import { NextRequest } from "next/server"

/**
 * Exports the payments table as CSV.
 *
 * Ops chooses the columns and the scope (NWP-101). Columns arriving from the
 * client are validated against the allowlist in `parseColumns`; scope decides
 * whether the active filters apply (`current`) or the whole table exports
 * (`all`). Filtering still runs through the one query builder.
 */
export function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams

  const scope = params.get("scope") === "all" ? "all" : "current"
  const filters = parseFilters(scope === "all" ? new URLSearchParams() : params)

  const columnsParam = params.get("columns")
  const columns =
    columnsParam === null ? DEFAULT_EXPORT_COLUMNS : parseColumns(columnsParam)

  if (columns.length === 0) {
    return new Response("Select at least one column to export.", {
      status: 400,
    })
  }

  const rows = sortPayments(
    filterPayments(filters),
    filters.sort,
    filters.direction,
  )

  const label =
    scope === "all"
      ? "all"
      : filters.status && filters.status !== "all"
        ? filters.status
        : "current"

  return new Response(toCsv(rows, columns), {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="${exportFilename(new Date(), label)}"`,
    },
  })
}
