import { filterPayments, parseFilters, sortPayments } from "@/data/queries"
import { PaymentFilters } from "@/data/types"
import { exportFilename, parseExportColumns, toCsv } from "@/lib/csv"
import { NextRequest, NextResponse } from "next/server"

type ExportScope = "current" | "all"

function parseScope(param: string | null): ExportScope {
  return param === "all" ? "all" : "current"
}

/**
 * What the file is of, for its name. Derived from filters that have already
 * been validated, so nothing the client typed reaches the filename.
 */
function scopeSlug(
  scope: ExportScope,
  filters: PaymentFilters,
): string | undefined {
  if (scope === "all") return "all"
  if (filters.status && filters.status !== "all") return filters.status
  if (filters.merchantId || filters.search || filters.from || filters.to) {
    return "filtered"
  }
  return undefined
}

/**
 * Exports the payments table as CSV.
 *
 * Ops chooses the columns and the scope; both are checked against an
 * allowlist here rather than trusted from the dialog. Filtering goes through
 * the one query builder, and pagination is deliberately skipped so the file
 * holds every matching row rather than the page ops happened to be on.
 */
export function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams
  const filters = parseFilters(params)
  const scope = parseScope(params.get("scope"))
  const columns = parseExportColumns(params.get("columns"))

  if (!columns) {
    return NextResponse.json(
      { message: "Select at least one column to export." },
      { status: 400 },
    )
  }

  // "All payments" ignores the active filters but keeps the operator's
  // ordering, and still goes through the shared builder.
  const scoped: PaymentFilters =
    scope === "all"
      ? { sort: filters.sort, direction: filters.direction }
      : filters

  const rows = sortPayments(
    filterPayments(scoped),
    filters.sort,
    filters.direction,
  )

  const filename = exportFilename(new Date(), scopeSlug(scope, filters))

  return new Response(toCsv(rows, columns), {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="${filename}"`,
    },
  })
}
