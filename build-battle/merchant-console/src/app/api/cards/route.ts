import { createCard, listCards, parseCreateCard } from "@/data/cards"
import { NextRequest, NextResponse } from "next/server"

export function GET() {
  // List payloads never carry a full number: records store last4 only.
  return NextResponse.json({ cards: listCards() })
}

export async function POST(request: NextRequest) {
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json(
      { message: "Request body must be valid JSON." },
      { status: 400 },
    )
  }

  const parsed = parseCreateCard(body)
  if (!parsed.ok) {
    return NextResponse.json({ message: parsed.error }, { status: 400 })
  }

  const { card, number } = createCard(parsed.input)
  // The one and only response that ever contains the full number.
  return NextResponse.json({ card, number }, { status: 201 })
}
