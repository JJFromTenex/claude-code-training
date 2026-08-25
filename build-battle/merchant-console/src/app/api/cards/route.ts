import { issueCard, listCards, parseCardFilters } from "@/data/cards"
import { store } from "@/data/store"
import { validateIssueInput } from "@/lib/cards"
import { NextRequest, NextResponse } from "next/server"

/** Masked view. The full number is never in a list payload. */
export function GET(request: NextRequest) {
  const filters = parseCardFilters(request.nextUrl.searchParams)
  return NextResponse.json({ cards: listCards(filters) })
}

/**
 * Issue a card.
 *
 * This is the one response that carries a full card number. It is not stored,
 * and no other route will ever return it again.
 */
export async function POST(request: NextRequest) {
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json(
      { message: "Send a JSON body." },
      { status: 400 },
    )
  }

  const merchantIds = store.merchants.map((merchant) => merchant.id)
  const validated = validateIssueInput(body, merchantIds)

  if (!validated.ok) {
    return NextResponse.json(
      {
        message: "Check the highlighted fields.",
        errors: validated.errors,
      },
      { status: 400 },
    )
  }

  const { card, fullNumber } = issueCard(validated.value)
  return NextResponse.json({ card, fullNumber }, { status: 201 })
}
