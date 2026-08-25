import {
  issueCard,
  parseCardFilters,
  queryCards,
  validateIssueRequest,
} from "@/data/cards"
import { NextRequest, NextResponse } from "next/server"

/** Cards, masked. The stored record has no full number to leak. */
export function GET(request: NextRequest) {
  const filters = parseCardFilters(request.nextUrl.searchParams)
  return NextResponse.json(queryCards(filters))
}

/**
 * Issue a card.
 *
 * The only response in this application that carries a full card number.
 * It is generated server-side, returned once, and never stored.
 */
export async function POST(request: NextRequest) {
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json(
      { message: "Expected a card to issue." },
      { status: 400 },
    )
  }

  const validated = validateIssueRequest(body)
  if (!validated.ok) {
    return NextResponse.json({ message: validated.message }, { status: 400 })
  }

  const { card, cardNumber } = issueCard(validated.value)
  return NextResponse.json({ card, cardNumber }, { status: 201 })
}
