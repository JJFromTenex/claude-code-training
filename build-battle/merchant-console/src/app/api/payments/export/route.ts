import { filterPayments, parseFilters, sortPayments } from "@/data/queries"
import { PaymentFilters } from "@/data/types"
import { exportFilename, parseColumns, toCsv } from "@/lib/csv"
import { NextRequest } from "next/server"

/**
 * Exports the payments table as CSV.
 *
 * Two things come from the client and are both checked here rather than
 * trusted: which columns to write, and whether to export the active filter or
 * everything. The dialog disables Download on an empty selection; this is the
 * enforcement.
 *
 * The rows are re-queried server side through the one query builder, so the
 * file is the whole matching set rather than the page the table happens to be
 * showing.
 */
export function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams

  const columns = parseColumns(params.get("columns"))
  if (columns.length === 0) {
    return Response.json(
      { message: "Choose at least one column to export." },
      { status: 400 },
    )
  }

  const filters = parseFilters(params)
  const exportAll = params.get("scope") === "all"

  // Scope "all" drops the filters but keeps the ordering ops was looking at.
  const scoped: PaymentFilters = exportAll
    ? { status: "all", sort: filters.sort, direction: filters.direction }
    : filters

  const rows = sortPayments(
    filterPayments(scoped),
    scoped.sort,
    scoped.direction,
  )

  // parseFilters has already reduced status to the allowlist, so the scope word
  // is ours rather than the caller's.
  const scopeWord = exportAll
    ? "all"
    : filters.status && filters.status !== "all"
      ? filters.status
      : "filtered"

  return new Response(toCsv(rows, columns), {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="${exportFilename(new Date(), scopeWord)}"`,
    },
  })
}
