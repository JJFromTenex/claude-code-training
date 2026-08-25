import { parseFilters, parseScope, queryPayments, scopedFilters } from "@/data/queries"
import { NextRequest, NextResponse } from "next/server"

export function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams
  const filters = parseFilters(params)
  const scope = parseScope(params.get("scope"))
  return NextResponse.json(queryPayments(scopedFilters(filters, scope)))
}
