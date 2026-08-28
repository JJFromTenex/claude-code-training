import { filterPayments, parseFilters, sortPayments } from "@/data/queries"
import { exportFilename, parseExportColumns, toCsv } from "@/lib/csv"
import { NextRequest, NextResponse } from "next/server"

/**
 * Exports the payments table as CSV.
 *
 * Ops chooses two things per export (NWP-101): which columns are included, and
 * whether the file covers the filter on screen or every payment. Both arrive
 * from the browser, so both are checked against an allowlist here — the dialog
 * disabling a button is a convenience, this is the enforcement.
 *
 * Scope is applied by handing the query builder a different set of filters,
 * never by filtering a second time. The payments table is paginated; the
 * export deliberately does not call `paginate`, so a filtered export is all
 * matching rows rather than the twenty on screen.
 */

/** The scopes a caller may ask for. Anything else falls back to the filter. */
const SCOPES = ["filter", "all"] as const
type Scope = (typeof SCOPES)[number]

function parseScope(raw: string | null): Scope {
  return SCOPES.includes(raw as Scope) ? (raw as Scope) : "filter"
}

/**
 * What the file is called after, in the order ops would describe it.
 *
 * An everything-export is "all". Otherwise the status carries the most
 * meaning — `payments-disputed-…` is the file someone asked for by name — and
 * a filter with no status is just "filtered".
 */
function scopeLabel(scope: Scope, status: string | undefined): string {
  if (scope === "all") return "all"
  if (status && status !== "all") return status
  return "filtered"
}

export function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams
  const filters = parseFilters(params)
  const scope = parseScope(params.get("scope"))
  const columns = parseExportColumns(params.get("columns"))

  // No valid column means no file worth writing. Refusing is the behaviour
  // ops asked for; serializing would hand them blank lines instead.
  if (columns.length === 0) {
    return NextResponse.json(
      { message: "Select at least one column to export." },
      { status: 400 },
    )
  }

  // Same builder either way — an "all" export is the unfiltered query, not a
  // second code path that could drift from the one behind GET /api/payments.
  const rows = sortPayments(
    filterPayments(scope === "all" ? {} : filters),
    filters.sort,
    filters.direction,
  )

  const filename = exportFilename(new Date(), scopeLabel(scope, filters.status))

  return new Response(toCsv(rows, columns), {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="${filename}"`,
    },
  })
}
