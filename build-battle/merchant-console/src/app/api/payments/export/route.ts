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
 * Ops chooses the columns and the scope; both arrive from the client and both
 * are checked against an allowlist here. The export is deliberately not
 * paginated — it is the whole result set, not the page ops happens to be on.
 */

const SCOPES = ["filtered", "all"] as const
type ExportScope = (typeof SCOPES)[number]

function parseScope(raw: string | null): ExportScope {
  return SCOPES.includes(raw as ExportScope) ? (raw as ExportScope) : "filtered"
}

export function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams

  // No columns param at all means "the usual set". An explicit empty or
  // all-unknown selection is a bad request, not an empty file.
  const requested = params.get("columns")
  const columns =
    requested === null ? DEFAULT_EXPORT_COLUMNS : parseExportColumns(requested)

  if (columns.length === 0) {
    return NextResponse.json(
      { message: "Select at least one column to export." },
      { status: 400 },
    )
  }

  const scope = parseScope(params.get("scope"))
  const filters = parseFilters(params)

  // Both scopes run through the one query builder. "all" drops the filters but
  // keeps the ordering, so the file is not in an arbitrary order.
  const query: PaymentFilters =
    scope === "all"
      ? { status: "all", sort: filters.sort, direction: filters.direction }
      : filters

  const rows = sortPayments(
    filterPayments(query),
    query.sort,
    query.direction,
  )

  const label =
    scope === "all"
      ? "all"
      : filters.status && filters.status !== "all"
        ? filters.status
        : undefined

  return new Response(toCsv(rows, columns), {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="${exportFilename(new Date(), label)}"`,
    },
  })
}
