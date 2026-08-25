import { filterPayments, parseFilters, sortPayments } from "@/data/queries"
import { exportFilename, parseExportColumns, toCsv } from "@/lib/csv"
import { NextRequest, NextResponse } from "next/server"

type Scope = "current" | "all"

function parseScope(raw: string | null): Scope {
  return raw === "all" ? "all" : "current"
}

/** The label that lands in the filename, per the rule in the NWP-101 epic. */
function scopeLabel(
  scope: Scope,
  filters: ReturnType<typeof parseFilters>,
): string | undefined {
  if (scope === "all") return "all"
  if (filters.status && filters.status !== "all") return filters.status
  const hasOtherFilter =
    Boolean(filters.merchantId) ||
    Boolean(filters.search) ||
    Boolean(filters.from) ||
    Boolean(filters.to)
  return hasOtherFilter ? "filtered" : undefined
}

/**
 * Exports the payments table as CSV.
 *
 * Ops chooses the columns and the scope (NWP-101). Column names arrive from
 * the client and are validated against the allowlist in `parseExportColumns`
 * before they reach `toCsv`. Scope reuses the one query builder: "current"
 * goes through `parseFilters`/`filterPayments` exactly as the list route
 * does, "all" calls `filterPayments({})` rather than adding a second filter
 * path.
 */
export function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams
  const scope = parseScope(params.get("scope"))
  const columns = parseExportColumns(params.get("columns"))

  if (columns.length === 0) {
    return NextResponse.json(
      { error: "Select at least one column to export." },
      { status: 400 },
    )
  }

  const filters = parseFilters(params)
  const rows = sortPayments(
    filterPayments(scope === "all" ? {} : filters),
    filters.sort,
    filters.direction,
  )

  return new Response(toCsv(rows, columns), {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="${exportFilename(new Date(), scopeLabel(scope, filters))}"`,
    },
  })
}
