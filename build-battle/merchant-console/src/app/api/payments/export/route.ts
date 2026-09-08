import { filterPayments, parseFilters, sortPayments } from "@/data/queries"
import {
  DEFAULT_EXPORT_COLUMNS,
  EXPORT_COLUMNS,
  ExportColumn,
  exportFilename,
  toCsv,
} from "@/lib/csv"
import { PaymentFilters } from "@/data/types"
import { NextRequest } from "next/server"

const SCOPES = ["current", "all"] as const
type Scope = (typeof SCOPES)[number]

const EXPORT_COLUMN_SET = new Set<string>(EXPORT_COLUMNS)

function badRequest(message: string): Response {
  return Response.json({ error: message }, { status: 400 })
}

type Parsed<T> = { ok: true; value: T } | { ok: false; error: string }

function parseScope(raw: string | null): Parsed<Scope> {
  if (raw === null) return { ok: true, value: "current" }
  if ((SCOPES as readonly string[]).includes(raw)) {
    return { ok: true, value: raw as Scope }
  }
  return { ok: false, error: "Unknown scope" }
}

function parseColumns(raw: string | null): Parsed<readonly ExportColumn[]> {
  if (raw === null) return { ok: true, value: DEFAULT_EXPORT_COLUMNS }

  const requested = raw
    .split(",")
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0)

  if (requested.length === 0) {
    return { ok: false, error: "Select at least one column" }
  }

  const seen = new Set<ExportColumn>()
  const ordered: ExportColumn[] = []
  for (const name of requested) {
    if (!EXPORT_COLUMN_SET.has(name)) {
      return { ok: false, error: `Unknown column: ${name}` }
    }
    const column = name as ExportColumn
    if (!seen.has(column)) {
      seen.add(column)
      ordered.push(column)
    }
  }
  return { ok: true, value: ordered }
}

function filenameSlug(scope: Scope, filters: PaymentFilters): string {
  if (scope === "all") return "all"
  const onlyStatus =
    filters.status &&
    filters.status !== "all" &&
    !filters.merchantId &&
    !filters.search &&
    !filters.from &&
    !filters.to
  return onlyStatus ? (filters.status as string) : "current"
}

export function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams

  const scope = parseScope(params.get("scope"))
  if (!scope.ok) return badRequest(scope.error)

  const columns = parseColumns(params.get("columns"))
  if (!columns.ok) return badRequest(columns.error)

  const filters = parseFilters(params)
  const scoped: PaymentFilters =
    scope.value === "all"
      ? { sort: filters.sort, direction: filters.direction }
      : filters

  const rows = sortPayments(
    filterPayments(scoped),
    scoped.sort,
    scoped.direction,
  )

  const filename = exportFilename({ scope: filenameSlug(scope.value, filters) })

  return new Response(toCsv(rows, columns.value), {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="${filename}"`,
    },
  })
}
