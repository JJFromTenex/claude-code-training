import { filterPayments, parseFilters, sortPayments } from "@/data/queries"
import { EXPORT_COLUMNS, ExportColumn, exportFilename, toCsv } from "@/lib/csv"
import { NextRequest } from "next/server"

export function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams
  const scope = params.get("scope") === "all" ? "all" : "filter"

  // Validate column names server-side against the allowlist
  const requested = params.getAll("columns")
  const columns: readonly ExportColumn[] =
    requested.length > 0
      ? (requested.filter((c) =>
          EXPORT_COLUMNS.includes(c as ExportColumn),
        ) as ExportColumn[])
      : EXPORT_COLUMNS

  if (columns.length === 0) {
    return new Response(JSON.stringify({ message: "No valid columns selected" }), {
      status: 400,
      headers: { "content-type": "application/json" },
    })
  }

  const filters = parseFilters(params)
  const rows =
    scope === "all"
      ? sortPayments(filterPayments({}), "createdAt", "desc")
      : sortPayments(filterPayments(filters), filters.sort, filters.direction)

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
