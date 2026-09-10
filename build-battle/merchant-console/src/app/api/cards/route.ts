import { issueCard, listCards } from "@/data/cards"
import { parseIssueCardInput } from "@/lib/cards"
import { NextRequest, NextResponse } from "next/server"

/**
 * Virtual cards (NWP-201).
 *
 * GET lists every issued card, masked: records carry the last four and a
 * reference, never a number. POST validates the body against the allowlists
 * in `src/lib/cards.ts` before anything reaches the store, then returns the
 * generated number exactly once, in this response and nowhere else.
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
      { error: "Request body must be JSON." },
      { status: 400 },
    )
  }

  const parsed = parseIssueCardInput(body)
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.error }, { status: 400 })
  }

  const { card, number } = issueCard(parsed.value)

  // The one response that carries the full number. The record does not.
  return NextResponse.json({ card, number }, { status: 201 })
}
