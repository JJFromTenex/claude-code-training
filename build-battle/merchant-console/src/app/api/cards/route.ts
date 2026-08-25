import { cardSpend, issueCard, listCards } from "@/data/cardQueries"
import { merchantById } from "@/data/merchants"
import { validateIssueInput } from "@/lib/cards"
import { NextRequest, NextResponse } from "next/server"

/**
 * `GET` lists issued cards, `POST` issues one.
 *
 * Neither response carries a full card number except the `POST` body, which is
 * the single reveal. Card records hold `last4` only, so a list response has
 * nothing to leak.
 */

export function GET() {
  const cards = listCards().map((card) => ({
    ...card,
    spent: cardSpend(card),
  }))
  return NextResponse.json({ cards })
}

export async function POST(request: NextRequest) {
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ message: "Expected a JSON body." }, { status: 400 })
  }

  if (typeof body !== "object" || body === null) {
    return NextResponse.json({ message: "Expected a JSON object." }, { status: 400 })
  }

  const validated = validateIssueInput(Object(body), {
    merchantCurrency: (id) => merchantById(id)?.currency,
  })

  if (!validated.ok) {
    return NextResponse.json(
      { message: "The card could not be issued.", errors: validated.errors },
      { status: 400 },
    )
  }

  const rawRequestId = Object(body).requestId
  const requestId = typeof rawRequestId === "string" && rawRequestId !== ""
    ? rawRequestId
    : null

  const { card, cardNumber, replayed } = issueCard(validated.value, requestId)

  // A replay returns the original card. The number is not repeated, because it
  // was never stored — that is the point of revealing once.
  return NextResponse.json(
    { card: { ...card, spent: cardSpend(card) }, cardNumber, replayed },
    { status: replayed ? 200 : 201 },
  )
}
