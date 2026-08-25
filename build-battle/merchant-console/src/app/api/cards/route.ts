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

  const { card, number } = createCard(result.data)
  return NextResponse.json({ card, number }, { status: 201 })
}
