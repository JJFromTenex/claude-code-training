import { filterPayments, parseFilters, sortPayments } from "@/data/queries"
import { exportFilename, parseExportColumns, toCsv } from "@/lib/csv"
import { NextRequest } from "next/server"

/**
 * Exports the payments table as CSV (NWP-101).
 *
 * Ops chooses the columns and the scope. Both arrive from the client, so both
 * are checked against an allowlist here — the dialog disabling Download is a
 * convenience, this is the enforcement. Rows come from the one query builder;
 * exporting in the browser would only ever capture the current page.
 */
export function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams

  const columns = parseExportColumns(params.get("columns"))
  if (columns.length === 0) {
    return Response.json(
      { message: "Select at least one column to export." },
      { status: 400 },
    )
  }

  const scope = params.get("scope") === "all" ? "all" : "filtered"
  const filters = parseFilters(params)

  // Scope "all" ignores the active filters but keeps the requested ordering.
  const rows = sortPayments(
    filterPayments(scope === "all" ? {} : filters),
    filters.sort,
    filters.direction,
  )

  return new Response(toCsv(rows, columns), {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="${exportFilename(
        new Date(),
        filenameScope(scope, params),
      )}"`,
    },
  })
}

/**
 * The scope segment of the filename. A status filter names itself, so ops can
 * tell `payments-disputed-...` from `payments-all-...` in a downloads folder.
 */
function filenameScope(
  scope: "all" | "filtered",
  params: URLSearchParams,
): string | undefined {
  if (scope === "all") return "all"

  const status = parseFilters(params).status
  if (status && status !== "all") return status

  const narrowed = ["merchantId", "search", "from", "to"].some((key) =>
    params.get(key),
  )
  return narrowed ? "filtered" : undefined
}
