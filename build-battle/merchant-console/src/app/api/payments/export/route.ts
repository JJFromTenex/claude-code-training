import { filterPayments, parseFilters, sortPayments } from "@/data/queries"
import { PaymentFilters } from "@/data/types"
import {
  DEFAULT_EXPORT_COLUMNS,
  exportFilename,
  exportLabel,
  parseExportColumns,
  toCsv,
} from "@/lib/csv"
import { NextRequest, NextResponse } from "next/server"

/**
 * Exports the payments table as CSV.
 *
 * `columns` (comma-separated) and `scope` (`current` | `all`) come from the
 * client and are validated here: column names against the export allowlist,
 * scope against its two values. `current` reuses the active filters and the
 * one query builder; `all` runs the same builder with the filters cleared.
 */
export function GET(request: NextRequest) {
  const sp = request.nextUrl.searchParams
  const parsed = parseFilters(sp)
  const scope = sp.get("scope") === "all" ? "all" : "current"

  const columns = sp.has("columns")
    ? parseExportColumns(
        (sp.get("columns") ?? "")
          .split(",")
          .map((name) => name.trim())
          .filter(Boolean),
      )
    : [...DEFAULT_EXPORT_COLUMNS]

  if (columns.length === 0) {
    return NextResponse.json(
      { message: "Select at least one column to export." },
      { status: 400 },
    )
  }

  const filters: PaymentFilters =
    scope === "all"
      ? { status: "all", sort: parsed.sort, direction: parsed.direction }
      : parsed

  const rows = sortPayments(
    filterPayments(filters),
    filters.sort,
    filters.direction,
  )

  const label = exportLabel(scope, scope === "all" ? "all" : parsed.status ?? "all")

  return new Response(toCsv(rows, columns), {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="${exportFilename(new Date(), label)}"`,
    },
  })
}
