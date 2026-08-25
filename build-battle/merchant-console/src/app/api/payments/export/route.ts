import { filterPayments, parseFilters, sortPayments } from "@/data/queries"
import { exportFilename, parseExportColumns, toCsv } from "@/lib/csv"
import { PaymentFilters } from "@/data/types"
import { NextRequest, NextResponse } from "next/server"

const EXPORT_SCOPES = ["filter", "all"] as const
type ExportScope = (typeof EXPORT_SCOPES)[number]

function parseScope(param: string | null): ExportScope {
  return param === "all" ? "all" : "filter"
}

/**
 * The label that goes in the filename: the active status when the scope is
 * the current filter and a status is set, "filtered" for an unfiltered
 * current-filter export, "all" for the all-payments scope.
 */
function scopeLabel(scope: ExportScope, status: PaymentFilters["status"]): string {
  if (scope === "all") return "all"
  return status && status !== "all" ? status : "filtered"
}

/**
 * Exports the payments table as CSV.
 *
 * Ops chooses the column set and the scope (current filter vs. all
 * payments) from the export dialog on /payments; both arrive here as query
 * params and are validated against an allowlist before they reach the
 * query builder or the filename. See NWP-101.
 */
export function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams
  const filters = parseFilters(params)
  const scope = parseScope(params.get("scope"))
  const columns = parseExportColumns(params.get("columns"))

  if (columns.length === 0) {
    return NextResponse.json(
      { error: "Select at least one column to export." },
      { status: 400 },
    )
  }

  const matched = scope === "all" ? filterPayments({ status: "all" }) : filterPayments(filters)
  const rows = sortPayments(matched, filters.sort, filters.direction)

  return new Response(toCsv(rows, columns), {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="${exportFilename(scopeLabel(scope, filters.status))}"`,
    },
  })
}
