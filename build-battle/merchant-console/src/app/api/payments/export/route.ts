import { filterPayments, parseFilters, sortPayments } from "@/data/queries"
import { store } from "@/data/store"
import {
  EXPORT_COLUMNS,
  ExportColumn,
  exportFilename,
  toCsv,
} from "@/lib/csv"
import { NextRequest, NextResponse } from "next/server"

const VALID_COLUMNS = new Set<string>(EXPORT_COLUMNS)
const VALID_SCOPES = new Set(["filtered", "all"])

function parseExportParams(params: URLSearchParams) {
  const rawColumns = params.get("columns")
  const columns: ExportColumn[] = rawColumns
    ? rawColumns.split(",").filter((c): c is ExportColumn => VALID_COLUMNS.has(c))
    : [...EXPORT_COLUMNS]

  if (columns.length === 0) {
    return {
      error: NextResponse.json(
        { message: "At least one valid column is required" },
        { status: 400 },
      ),
    }
  }

  const rawScope = params.get("scope")
  const scope = VALID_SCOPES.has(rawScope ?? "") ? (rawScope as "filtered" | "all") : "filtered"

  return { columns, scope }
}

export function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams
  const exported = parseExportParams(params)
  if ("error" in exported) return exported.error
  const { columns, scope } = exported

  const filters = parseFilters(params)

  const rows =
    scope === "all"
      ? sortPayments([...store.payments], filters.sort, filters.direction)
      : sortPayments(filterPayments(filters), filters.sort, filters.direction)

  const statusLabel =
    filters.status && filters.status !== "all" ? filters.status : undefined

  return new Response(toCsv(rows, columns), {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="${exportFilename(statusLabel)}"`,
    },
  })
}
