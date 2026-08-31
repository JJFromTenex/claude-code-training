import { createCard, parseCardFilters, queryCards } from "@/data/cards"
import { NextRequest, NextResponse } from "next/server"

export function GET(request: NextRequest) {
  const filters = parseCardFilters(request.nextUrl.searchParams)
  return NextResponse.json(queryCards(filters))
}

/**
 * Issue a card.
 *
 * This is the one response in the application that carries a full card
 * number. Every later read of the same card returns `last4` only.
 */
export async function POST(request: NextRequest) {
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ message: "Expected a JSON body." }, { status: 400 })
  }

  if (typeof body !== "object" || body === null) {
    return NextResponse.json({ message: "Expected a JSON object." }, { status: 400 })
  }

  const result = createCard(body as Parameters<typeof createCard>[0])
  if (!result.ok) {
    return NextResponse.json(
      { field: result.error.field, message: result.error.message },
      { status: 400 },
    )
  }

  // A repeat of an idempotency key is not a creation, so it is not a 201 —
  // and it carries no number, because the one reveal already happened.
  return NextResponse.json(
    {
      card: result.value.card,
      number: result.value.number,
      duplicate: result.value.duplicate,
    },
    { status: result.value.duplicate ? 200 : 201 },
  )
}
