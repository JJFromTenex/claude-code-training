import { issueCard, listCards } from "@/data/card-queries"
import { merchantById } from "@/data/merchants"
import { validateIssueInput } from "@/lib/cards"
import { NextRequest, NextResponse } from "next/server"

/** Every issued card, masked. The full number is never in this payload. */
export function GET() {
  return NextResponse.json({ cards: listCards() })
}

/**
 * Issues a card.
 *
 * This is the only response that ever carries a full card number. Everything
 * afterwards — the list, the detail, the record itself — holds the last four.
 */
export async function POST(request: NextRequest) {
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json(
      { message: "Send the card details as JSON." },
      { status: 400 },
    )
  }

  const parsed = validateIssueInput(
    body,
    (id) => merchantById(id)?.currency ?? null,
  )
  if (!parsed.ok) {
    return NextResponse.json({ message: parsed.message }, { status: 400 })
  }

  const { card, cardNumber } = issueCard(parsed.value)
  return NextResponse.json({ card, cardNumber }, { status: 201 })
}
