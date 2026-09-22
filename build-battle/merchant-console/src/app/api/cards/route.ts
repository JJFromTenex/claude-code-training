import { issueCard, listCards, parseIssueCardInput } from "@/data/cards"
import { NextRequest, NextResponse } from "next/server"

/** Every issued card, masked. The full number is never in this payload. */
export function GET() {
  return NextResponse.json({ cards: listCards() })
}

/**
 * Issues a card.
 *
 * This is the one and only response that carries the full number. It is not
 * stored, so it cannot be read back from anywhere else.
 */
export async function POST(request: NextRequest) {
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Expected a JSON body." }, { status: 400 })
  }

  const parsed = parseIssueCardInput(body)
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.error }, { status: 400 })
  }

  const { card, number } = issueCard(parsed.value)
  return NextResponse.json({ card, number }, { status: 201 })
}
