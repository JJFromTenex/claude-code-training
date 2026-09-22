import { createCard, listCards, validateIssueCardInput } from "@/data/cards"
import { NextRequest, NextResponse } from "next/server"

/**
 * Cards.
 *
 * `POST` is the only response in this application that contains a full card
 * number. The stored record has no field for one, so a list or detail payload
 * cannot leak it even by accident.
 *
 * Validation lives in `validateIssueCardInput`, so this handler never reads a
 * field out of the body itself — the same split as `GET /api/payments` and
 * `parseFilters`.
 */

/** Every issued card, masked. Never a full number. */
export function GET() {
  return NextResponse.json({ cards: listCards() })
}

export async function POST(request: NextRequest) {
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json(
      { message: "Expected a JSON body." },
      { status: 400 },
    )
  }

  const result = validateIssueCardInput(body)
  if (!result.ok) {
    return NextResponse.json(
      { message: result.message, fieldErrors: result.fieldErrors },
      { status: 400 },
    )
  }

  const { card, fullNumber } = createCard(result.values)

  // The one and only reveal. It is not stored, and it is not returned again.
  return NextResponse.json({ card, fullNumber }, { status: 201 })
}
