import { filterPayments, parseFilters, sortPayments } from "@/data/queries"
import { PaymentFilters } from "@/data/types"
import {
  DEFAULT_EXPORT_COLUMNS,
  ExportScope,
  exportFilename,
  parseExportColumns,
  toCsv,
} from "@/lib/csv"
import { NextRequest, NextResponse } from "next/server"

/**
 * Exports the payments table as CSV.
 *
 * Ops chooses the columns and the scope; both arrive as query params and
 * neither is trusted. Filtering goes through the one query builder, and
 * pagination is deliberately skipped — an export covers the whole result
 * set, not the page that happens to be on screen.
 */

/** Which scope names the file. Derived from filters already checked by parseFilters. */
function scopeFor(everything: boolean, filters: PaymentFilters): ExportScope {
  if (everything) return "all"
  if (filters.status && filters.status !== "all") return filters.status
  if (filters.merchantId || filters.search || filters.from || filters.to) {
    return "filtered"
  }
  return "all"
}

export function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams
  const filters = parseFilters(params)
  const everything = params.get("scope") === "all"

  const requested = params.getAll("columns")
  const columns = params.has("columns")
    ? parseExportColumns(requested)
    : DEFAULT_EXPORT_COLUMNS

  if (!columns) {
    return NextResponse.json(
      {
        message: requested.some((column) => column.length > 0)
          ? "That is not a column you can export."
          : "Choose at least one column to export.",
      },
      { status: 400 },
    )
  }

  // An unfiltered call still goes through the builder rather than reading the
  // store, so "all payments" and "current filter" cannot drift apart.
  const rows = sortPayments(
    filterPayments(everything ? {} : filters),
    filters.sort,
    filters.direction,
  )

  return new Response(toCsv(rows, columns), {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="${exportFilename(
        scopeFor(everything, filters),
      )}"`,
    },
  })
}
