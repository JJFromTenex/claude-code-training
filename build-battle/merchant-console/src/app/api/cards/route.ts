import { issueCard, listCards, validateIssueInput } from "@/data/cards"
import { NextRequest, NextResponse } from "next/server"

/**
 * Cards.
 *
 * `POST` is the only response in this application that carries a full card
 * number, and it carries it once. Nothing that reads a card afterwards — this
 * route's own `GET` included — can return one, because the stored record does
 * not have the field.
 */

export function GET() {
  return NextResponse.json({ cards: listCards() })
}

export async function POST(request: NextRequest) {
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Expected a JSON body." }, { status: 400 })
  }

  const validated = validateIssueInput(body)
  if (!validated.ok) {
    return NextResponse.json(
      { error: validated.error, field: validated.field },
      { status: validated.status },
    )
  }

  const { card, cardNumber } = issueCard(validated.value)
  return NextResponse.json({ card, cardNumber }, { status: 201 })
}
