import { issueCard, listCards } from "@/data/cards"
import { NextRequest, NextResponse } from "next/server"

/**
 * The cards collection.
 *
 * POST is the only response in the console that ever carries a full card
 * number. Every other route returns the last four and the reference.
 */

export function GET() {
  return NextResponse.json({ cards: listCards() })
}

export async function POST(request: NextRequest) {
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json(
      { error: "Request body must be JSON" },
      { status: 400 },
    )
  }

  const result = issueCard(body)
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status })
  }

  return NextResponse.json(
    { card: result.card, number: result.number, replayed: result.replayed },
    // A replay created nothing, so it is not a 201.
    { status: result.replayed ? 200 : 201 },
  )
}
