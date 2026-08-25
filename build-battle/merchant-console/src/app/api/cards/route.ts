import { issueCardOnce, listCards, validateIssueInput } from "@/data/cards"
import { NextRequest, NextResponse } from "next/server"

/**
 * Virtual cards.
 *
 * GET returns the list, masked: the record carries the last four and nothing
 * more, so there is no full number here to withhold. POST issues a card and is
 * the one and only response that ever contains the full number.
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
      { message: "Expected a JSON body." },
      { status: 400 },
    )
  }

  // The client validates too, but this is the enforcement.
  const parsed = validateIssueInput(body)
  if ("error" in parsed) {
    return NextResponse.json({ message: parsed.error }, { status: 400 })
  }

  // Ops double-clicking Issue, or a client retry, must not mint two cards.
  const key = request.headers.get("idempotency-key")
  const { card, cardNumber, replayed } = issueCardOnce(parsed.input, key)

  // cardNumber appears here and nowhere else, ever — and not on a replay,
  // because reveal-once outranks returning an identical body.
  return NextResponse.json(
    { card, cardNumber, replayed },
    { status: replayed ? 200 : 201 },
  )
}
