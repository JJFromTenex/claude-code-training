import { addCard, allCards, merchantIds, nextCardId } from "@/data/cards"
import { issueCard, validateCardInput } from "@/lib/cards"
import { NextRequest, NextResponse } from "next/server"

/**
 * Cards.
 *
 * GET returns the issued cards. The records carry `last4` and never a full
 * number — the full number exists in exactly one response, the POST below.
 */
export function GET() {
  return NextResponse.json({ cards: allCards() })
}

/**
 * Issues a card.
 *
 * Everything from the client is validated here; the dialog's own checks are
 * a convenience. The number is generated server-side and returned once, in
 * `fullNumber`, which is never written to the store.
 */
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

  const parsed = validateCardInput(
    (body ?? {}) as Record<string, unknown>,
    merchantIds(),
  )
  if (!parsed.ok) {
    return NextResponse.json({ message: parsed.message }, { status: 400 })
  }

  const { card, fullNumber } = issueCard(parsed.value, {
    id: nextCardId(),
    now: new Date(),
  })
  addCard(card)

  // The only response that carries the full number.
  return NextResponse.json({ card, fullNumber }, { status: 201 })
}
