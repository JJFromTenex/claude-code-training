import { createCard, parseCardInput } from "@/data/cards"
import { NextRequest, NextResponse } from "next/server"

/**
 * Issues a card. The response body is the only place the full number ever
 * appears — nothing downstream can read it again.
 */
export async function POST(request: NextRequest) {
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 })
  }

  const { data, errors } = parseCardInput(body)
  if (!data) {
    return NextResponse.json({ error: "Validation failed.", errors }, { status: 400 })
  }

  const { card, number } = createCard(data)
  return NextResponse.json({ card, number }, { status: 201 })
}
