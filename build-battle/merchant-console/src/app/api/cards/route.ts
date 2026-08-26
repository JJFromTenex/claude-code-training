import { issueCard, listCards, parseCardInput } from "@/data/cards"
import { maskCardNumber } from "@/lib/cards"
import { NextRequest, NextResponse } from "next/server"

/** Never carries a full number: the `Card` record has no field for one. */
export function GET() {
  return NextResponse.json({
    cards: listCards().map((card) => ({
      ...card,
      masked: maskCardNumber(card.last4),
    })),
  })
}

/** The only response the full number ever appears in. */
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

  // A retry must not put two live cards on one merchant.
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
    {
      status: replayed ? 200 : 201,
      // The only response in the app that carries a full number. POSTs are not
      // cached by default; this says so out loud rather than relying on it.
      headers: { "Cache-Control": "no-store" },
    },
  )
}
