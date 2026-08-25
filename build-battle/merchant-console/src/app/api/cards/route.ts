import { createCard, parseCardFilters, parseIssueCardInput, queryCards } from "@/data/cardQueries"
import { NextRequest, NextResponse } from "next/server"

export function GET(request: NextRequest) {
  const filters = parseCardFilters(request.nextUrl.searchParams)
  return NextResponse.json(queryCards(filters))
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null)
  const parsed = parseIssueCardInput(body)

  if (!parsed.ok) {
    return NextResponse.json(
      { error: "Invalid card request", fields: parsed.fields },
      { status: 422 },
    )
  }

  const { card, number } = createCard(parsed.value)
  return NextResponse.json({ card, number }, { status: 201 })
}
