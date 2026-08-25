import { issueCard, parseCardFilters, queryCards } from "@/data/queries"
import { NextRequest, NextResponse } from "next/server"

/** Never returns a full card number — see the POST handler for the one exception. */
export function GET(request: NextRequest) {
  const filters = parseCardFilters(request.nextUrl.searchParams)
  return NextResponse.json(queryCards(filters))
}

/**
 * Issues a card. Validation happens server-side inside `issueCard()` — the
 * client is not trusted. The response is the one and only place the full
 * number appears (`.claude/rules/cards.md`).
 *
 * An optional `idempotencyKey` makes a retried or double-submitted request
 * return the original card instead of minting a second one.
 */
export async function POST(request: NextRequest) {
  let body: Record<string, unknown>
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ message: "Invalid request body." }, { status: 400 })
  }

  const idempotencyKey =
    typeof body.idempotencyKey === "string" ? body.idempotencyKey : undefined
  const result = issueCard(body as Record<string, unknown>, idempotencyKey)
  if (!result.ok) {
    return NextResponse.json({ message: result.error }, { status: 400 })
  }

  return NextResponse.json(
    { card: result.card, number: result.number },
    { status: 201 },
  )
}
