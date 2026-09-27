import {
  issueCard,
  issuedCardForKey,
  listCards,
  parseIssueCardInput,
  rememberIssueKey,
} from "@/data/cards"
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

  // A retry, a refresh, or a second tab must not mint a second card. The
  // replay gets the original record back — without the number, which existed
  // only in the first response.
  const key = request.headers.get("idempotency-key")
  if (key) {
    const existing = issuedCardForKey(key)
    if (existing) {
      return NextResponse.json({ card: existing, replayed: true })
    }
  }

  const { card, number } = issueCard(parsed.value)
  if (key) rememberIssueKey(key, card.id)
  return NextResponse.json({ card, number }, { status: 201 })
}
