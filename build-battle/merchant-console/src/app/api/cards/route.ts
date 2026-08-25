import { issueCard, listCards, parseCardInput } from "@/data/cards"
import { maskCardNumber } from "@/lib/cards"
import { NextRequest, NextResponse } from "next/server"

/**
 * Cards the console has issued. Never carries a full number: the `Card` record
 * has no field for one, so there is nothing here to leak.
 */
export function GET() {
  return NextResponse.json({
    cards: listCards().map((card) => ({
      ...card,
      masked: maskCardNumber(card.last4),
    })),
  })
}

/**
 * Issues a card. This response is the only place the full number ever appears
 * — it is not stored, so it cannot be read back from anywhere else.
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

  const parsed = parseCardInput(body)
  if (!parsed.ok) {
    return NextResponse.json({ message: parsed.message }, { status: 400 })
  }

  /**
   * A retry — a double-click, or a request the network replayed — must not put
   * two live cards on one merchant. The disabled button cannot promise that;
   * it lives in the tab that may already be gone.
   */
  const idempotencyKey = request.headers.get("Idempotency-Key") ?? undefined

  const issued = issueCard(parsed.value, idempotencyKey)
  if (!issued.ok) {
    // The key was already spent on a different card. That is a client bug,
    // not a retry, and answering with the earlier card would be a lie.
    return NextResponse.json({ message: issued.message }, { status: 409 })
  }

  const { card, cardNumber, replayed } = issued.value
  return NextResponse.json(
    { card, cardNumber, replayed },
    { status: replayed ? 200 : 201 },
  )
}
