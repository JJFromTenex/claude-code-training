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

  const { card, fullNumber } = createCard(parsed.value)
  return NextResponse.json({ card, fullNumber }, { status: 201 })
}
