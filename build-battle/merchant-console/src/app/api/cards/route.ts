import { createCard, listCards, parseCardInput } from "@/data/cards"
import { NextRequest, NextResponse } from "next/server"

export function GET() {
  const rows = listCards()
  return NextResponse.json({ rows, total: rows.length })
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null)
  const parsed = parseCardInput(body)
  if (!parsed.ok) {
    return NextResponse.json({ message: parsed.message }, { status: 400 })
  }

  // Idempotency-Key is transport metadata, not part of the card, so it rides
  // on the header rather than in the body.
  const rawKey = request.headers.get("idempotency-key")
  const idempotencyKey = rawKey && rawKey.length > 0 ? rawKey : undefined

  const { card, fullNumber, replay } = createCard(parsed.value, idempotencyKey)

  // A replay never re-reveals the number: reveal-once means it exists in
  // exactly one response ever, and that response already happened.
  if (replay) {
    return NextResponse.json({ card }, { status: 200 })
  }
  return NextResponse.json({ card, fullNumber }, { status: 201 })
}
