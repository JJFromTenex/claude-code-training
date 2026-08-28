import { filterPayments, parseFilters, sortPayments } from "@/data/queries"
import { PaymentFilters } from "@/data/types"
import {
  DEFAULT_EXPORT_COLUMNS,
  exportFilename,
  parseExportColumns,
  toCsv,
} from "@/lib/csv"
import { NextRequest, NextResponse } from "next/server"

/**
 * Exports the payments table as CSV.
 *
 * Ops chooses the columns and the scope. Both arrive from the client, so both
 * are checked against an allowlist here before they reach a file — the browser
 * dialog is a convenience, not the enforcement. Scope "all" ignores the active
 * filters; anything else exports exactly what the table is showing. Either way
 * the one query builder does the work, unpaginated.
 */
export function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams
  const filters = parseFilters(params)

  const requested = params.get("columns")
  const columns = requested
    ? parseExportColumns(requested)
    : DEFAULT_EXPORT_COLUMNS

  if (columns.length === 0) {
    return NextResponse.json(
      { message: "Pick at least one column to export." },
      { status: 400 },
    )
  }

  const everything = params.get("scope") === "all"
  const rows = sortPayments(
    filterPayments(everything ? { status: "all" } : filters),
    filters.sort,
    filters.direction,
  )

  return new Response(toCsv(rows, columns), {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="${exportFilename(
        scopeLabel(everything, filters.status),
      )}"`,
    },
  })
}

/** What the filename calls this file. Only allowlisted values reach it. */
function scopeLabel(
  everything: boolean,
  status: PaymentFilters["status"],
): string {
  if (everything) return "all"
  return status && status !== "all" ? status : "filtered"
}
