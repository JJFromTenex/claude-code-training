import { merchantById } from "@/data/merchants"
import { filterPayments, parseFilters, sortPayments } from "@/data/queries"
import { PaymentFilters } from "@/data/types"
import {
  ExportScope,
  exportFilename,
  parseExportColumns,
  parseExportScope,
  toCsv,
} from "@/lib/csv"
import { NextRequest, NextResponse } from "next/server"

/**
 * Exports the payments table as CSV.
 *
 * Built here rather than in the browser: the table is paginated, so a
 * client-side export would only ever hold the visible page. This runs the
 * same query builder as GET /api/payments, minus the pagination step.
 *
 * Params, all validated against allowlists before use:
 * - `scope`: `filter` (default) honors the active filters, `all` ignores them
 * - `columns`: comma-separated; absent means every column but the last four
 */
export function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams

  const scope = parseExportScope(params.get("scope"))
  if (!scope.ok) return badRequest(scope.message)

  const columns = parseExportColumns(params.get("columns"))
  if (!columns.ok) return badRequest(columns.message)

  const parsed = parseFilters(params)
  const filters: PaymentFilters =
    scope.value === "all"
      ? { sort: parsed.sort, direction: parsed.direction }
      : parsed

  const rows = sortPayments(
    filterPayments(filters),
    filters.sort,
    filters.direction,
  )

  return new Response(toCsv(rows, columns.value), {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="${exportFilename(
        new Date(),
        filenameLabel(scope.value, filters),
      )}"`,
    },
  })
}

function badRequest(message: string) {
  return NextResponse.json({ error: message }, { status: 400 })
}

/**
 * Names the scope in the filename using validated values only: the status is
 * allowlisted by parseFilters and the merchant id must resolve. Search text
 * never reaches the filename.
 */
function filenameLabel(
  scope: ExportScope,
  filters: PaymentFilters,
): string | undefined {
  if (scope === "all") return "all"

  const parts: string[] = []
  if (filters.status && filters.status !== "all") parts.push(filters.status)
  if (filters.merchantId && merchantById(filters.merchantId)) {
    parts.push(filters.merchantId)
  }
  if (parts.length === 0 && (filters.search || filters.from || filters.to)) {
    parts.push("filtered")
  }
  return parts.length > 0 ? parts.join("-") : undefined
}
