import { createCard, listCards } from "@/data/cardQueries"
import { validateCreateCardInput } from "@/lib/cards"
import { NextRequest, NextResponse } from "next/server"

export function GET() {
  return NextResponse.json({ cards: listCards() })
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null)
  const result = validateCreateCardInput(body)
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 400 })
  }

  const created = createCard(result.data)
  if (!created.ok) {
    return NextResponse.json({ error: created.error }, { status: created.status })
  }
  return NextResponse.json({ card: created.card, number: created.number }, { status: 201 })
}
