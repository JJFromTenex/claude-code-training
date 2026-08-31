import { filterPayments, parseFilters, sortPayments } from "@/data/queries"
import { PaymentFilters } from "@/data/types"
import { exportFilename, parseExportColumns, toCsv } from "@/lib/csv"
import { NextRequest, NextResponse } from "next/server"

/**
 * Exports the payments table as CSV.
 *
 * Ops chooses the columns and the scope (NWP-101). Both arrive from the client,
 * so both are checked against an allowlist here — the dialog disabling Download
 * is a convenience, never the enforcement. Filtering goes through the one query
 * builder, and pagination is skipped on purpose so "all payments" means all of
 * them rather than whichever page the table happens to be showing.
 */

const SCOPES = ["filtered", "all"] as const

type Scope = (typeof SCOPES)[number]

/** The segment that lands in the filename, derived from what was exported. */
function filenameScope(
  scope: Scope,
  status: PaymentFilters["status"],
): string | undefined {
  if (scope === "all") return "all"
  return status && status !== "all" ? status : undefined
}

export function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams

  const columns = parseExportColumns(params.get("columns"))
  if (!columns) {
    return NextResponse.json(
      {
        message:
          "Columns must be one or more names from the payments export column list.",
      },
      { status: 400 },
    )
  }

  const requestedScope = params.get("scope")
  if (requestedScope !== null && !SCOPES.includes(requestedScope as Scope)) {
    return NextResponse.json(
      { message: "Scope must be the current filter or all payments." },
      { status: 400 },
    )
  }
  const scope: Scope = requestedScope === "all" ? "all" : "filtered"

  const filters = parseFilters(params)
  const rows = sortPayments(
    filterPayments(scope === "all" ? {} : filters),
    filters.sort,
    filters.direction,
  )
  const filename = exportFilename(
    new Date(),
    filenameScope(scope, filters.status),
  )

  return new Response(toCsv(rows, columns), {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="${filename}"`,
    },
  })
}
