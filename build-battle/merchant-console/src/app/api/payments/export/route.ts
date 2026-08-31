import { filterPayments, parseFilters, sortPayments } from "@/data/queries"
import { PaymentFilters } from "@/data/types"
import {
  EXPORT_COLUMNS,
  ExportColumn,
  exportFilename,
  parseExportColumns,
  toCsv,
} from "@/lib/csv"
import { NextRequest } from "next/server"

/**
 * Exports the payments table as CSV.
 *
 * Ops controls the column set (`columns`) and the scope (`scope`). Both are
 * validated on the server before anything reaches the query builder or the
 * serializer, and filtering always goes through the one query builder.
 */
export function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl

  // Columns: if the client sent them, honor the validated allowlist; an empty
  // result means every requested name was bogus, so reject. If absent, ship
  // every column (backward compatible).
  let columns: readonly ExportColumn[] = EXPORT_COLUMNS
  if (searchParams.has("columns")) {
    const requested = parseExportColumns(searchParams.get("columns"))
    if (requested.length === 0) {
      return new Response(
        JSON.stringify({ message: "Select at least one column to export." }),
        { status: 400, headers: { "content-type": "application/json" } },
      )
    }
    columns = requested
  }

  const current = parseFilters(searchParams)
  const scope = searchParams.get("scope") ?? "current"

  // Scope "all" ignores status/merchant/search/from/to but still runs through
  // the one query builder rather than touching the store directly.
  const filters: PaymentFilters =
    scope === "all"
      ? { status: "all", sort: current.sort, direction: current.direction }
      : current

  const rows = sortPayments(
    filterPayments(filters),
    filters.sort,
    filters.direction,
  )

  const scopeLabel =
    scope === "all" ? "all" : current.status !== "all" ? current.status : ""

  return new Response(toCsv(rows, columns), {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="${exportFilename(
        new Date(),
        scopeLabel,
      )}"`,
    },
  })
}
