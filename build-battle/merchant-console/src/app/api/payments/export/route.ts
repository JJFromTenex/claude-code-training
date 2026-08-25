import { filterPayments, parseFilters, sortPayments } from "@/data/queries"
import { PaymentFilters } from "@/data/types"
import { exportFilename, parseExportColumns, toCsv } from "@/lib/csv"
import { NextRequest, NextResponse } from "next/server"

/**
 * Exports the payments table as CSV.
 *
 * Ops picks the columns and the scope; both arrive from the client and are
 * checked against an allowlist here before they reach a query or a filename.
 */
export function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams

  const columns = parseExportColumns(params.get("columns"))
  if (columns === null) {
    return NextResponse.json(
      { message: "Select at least one valid column to export." },
      { status: 400 },
    )
  }

  const scopeParam = params.get("scope") ?? "current"
  if (scopeParam !== "current" && scopeParam !== "all") {
    return NextResponse.json(
      { message: "Scope must be either the current filter or all payments." },
      { status: 400 },
    )
  }

  const filters = parseFilters(params)
  const scoped: PaymentFilters = scopeParam === "all" ? {} : filters

  const rows = sortPayments(
    filterPayments(scoped),
    filters.sort,
    filters.direction,
  )

  const filename = exportFilename(new Date(), scopeSlug(scopeParam, filters))

  return new Response(toCsv(rows, columns), {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="${filename}"`,
    },
  })
}

/** Names the file after what is in it: the status, or that it was narrowed at all. */
function scopeSlug(scope: "current" | "all", filters: PaymentFilters): string {
  if (scope === "all") return "all"
  if (filters.status && filters.status !== "all") return filters.status
  const narrowed = filters.merchantId || filters.search || filters.from || filters.to
  return narrowed ? "filtered" : "all"
}
