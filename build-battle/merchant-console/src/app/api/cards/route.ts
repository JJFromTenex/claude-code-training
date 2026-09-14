import { issueCard, listCards, parseIssueCardInput } from "@/data/cards"
import { NextRequest, NextResponse } from "next/server"

/** Every card, masked. Records carry last4 only, so there is nothing to strip. */
export function GET() {
  return NextResponse.json({ rows: listCards() })
}

/**
 * Issue a card. This is the one response that carries the full number; the
 * stored record holds the last four and a reference, and no other route can
 * return it.
 */
export async function POST(request: NextRequest) {
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Request body must be JSON." }, { status: 400 })
  }

  const parsed = parseIssueCardInput(body)
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.error }, { status: 400 })
  }

  const { card, number } = issueCard(parsed.value)
  return NextResponse.json({ card, number }, { status: 201 })
}
