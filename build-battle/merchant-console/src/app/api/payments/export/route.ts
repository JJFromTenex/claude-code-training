import { filterPayments, parseFilters, sortPayments } from "@/data/queries"
import { PaymentFilters } from "@/data/types"
import {
  ExportScope,
  exportFilename,
  parseExportColumns,
  toCsv,
} from "@/lib/csv"
import { NextRequest, NextResponse } from "next/server"

/**
 * Exports the payments table as CSV.
 *
 * Ops chooses the columns and the scope (NWP-101). Both arrive from the
 * client, so both are checked against an allowlist here before they reach the
 * query builder, the serializer, or the filename. This handler is the only
 * place that reads the search params.
 */

/**
 * Names what is in the file: `all` when ops asked for everything, the status
 * when the table was narrowed to one, `filtered` when some other filter was
 * applied. Nothing narrowed means no segment, which is the plain
 * `payments-<date>.csv` this route has always produced.
 */
function scopeSegment(
  scope: "all" | "filtered",
  filters: PaymentFilters,
): ExportScope | undefined {
  if (scope === "all") return "all"
  if (filters.status && filters.status !== "all") return filters.status
  if (filters.merchantId || filters.search || filters.from || filters.to) {
    return "filtered"
  }
  return undefined
}

export function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams
  const filters = parseFilters(params)
  const columns = parseExportColumns(params.get("columns"))

  // Reject early. An empty selection asks for a file with no columns in it;
  // the dialog disables Download to prevent that, but a disabled button is a
  // convenience and this is the enforcement.
  if (columns.length === 0) {
    return NextResponse.json(
      { message: "Select at least one column to export." },
      { status: 400 },
    )
  }

  const scope = params.get("scope") === "all" ? "all" : "filtered"

  // Empty filters is how "all payments" goes through the one query builder
  // instead of reaching for the store directly. Scope decides what is
  // included; sort is a presentation choice and survives either.
  const rows = sortPayments(
    filterPayments(scope === "all" ? {} : filters),
    filters.sort,
    filters.direction,
  )

  // No paginate() on purpose: an export is every matching row, not the twenty
  // on screen. Folding this into queryPayments would silently truncate it.
  const filename = exportFilename(new Date(), scopeSegment(scope, filters))

  return new Response(toCsv(rows, columns), {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="${filename}"`,
    },
  })
}
