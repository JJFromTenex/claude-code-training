import { createCard, listCards, validateCardInput } from "@/data/queries"
import { NextRequest, NextResponse } from "next/server"

export function GET() {
  return NextResponse.json({ rows: listCards() })
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null)
  const result = validateCardInput(body)
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 400 })
  }

  const { card, number } = createCard(result.value)
  return NextResponse.json({ card, number })
}
