import {
  filterPayments,
  parseExportOptions,
  parseFilters,
  sortPayments,
} from "@/data/queries"
import { ExportScope, PaymentFilters } from "@/data/types"
import { exportFilename, toCsv } from "@/lib/csv"
import { NextRequest, NextResponse } from "next/server"

/**
 * Exports the payments table as CSV.
 *
 * Ops chooses the columns and the scope (NWP-101). Both arrive from the client
 * and are allowlisted in `parseExportOptions` before they reach the query or
 * the filename; this handler reads no params of its own.
 *
 * `scope=all` drops the filters and keeps the ordering. It is the same query
 * builder either way — a second filter path would be a defect.
 */
export function GET(request: NextRequest) {
  const filters = parseFilters(request.nextUrl.searchParams)
  const { columns, scope, columnsRequested } = parseExportOptions(
    request.nextUrl.searchParams,
  )

  if (columnsRequested && columns.length === 0) {
    return NextResponse.json(
      { message: "Select at least one column to export." },
      { status: 400 },
    )
  }

  const scoped: PaymentFilters =
    scope === "all"
      ? { sort: filters.sort, direction: filters.direction }
      : filters

  const rows = sortPayments(
    filterPayments(scoped),
    scoped.sort,
    scoped.direction,
  )

  return new Response(toCsv(rows, columns), {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="${exportFilename(
        new Date(),
        filenameScope(scope, filters.status),
      )}"`,
    },
  })
}

/**
 * The scope segment of the filename: `payments-disputed-2026-08-13.csv`.
 *
 * Status only. Putting the merchant in here as well would mean slugging a
 * merchant name into a filename, and the ticket's example does not ask for it
 * — see the open questions in the epic.
 */
function filenameScope(
  scope: ExportScope,
  status: PaymentFilters["status"],
): string | undefined {
  if (scope === "all") return "all"
  if (status && status !== "all") return status
  return undefined
}
