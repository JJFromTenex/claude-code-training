import {
  createCard,
  currencyMismatch,
  findRecentDuplicate,
  listCards,
  validateCreateCard,
} from "@/data/cards"
import { NextRequest, NextResponse } from "next/server"

/**
 * List every issued card. Card records carry `last4` and `reference` only —
 * the full number is not on the record, so this route cannot leak one.
 */
export function GET() {
  return NextResponse.json({ cards: listCards() })
}

/**
 * Issue a card. This is the **one** response in the application that contains
 * a full card number. It is not stored and cannot be read back.
 */
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

  const result = validateCreateCard((body ?? {}) as Record<string, unknown>)
  if (!result.ok) {
    return NextResponse.json(
      { message: result.error.message, field: result.error.field },
      { status: 400 },
    )
  }

  // Ops double-clicks a form that feels slow. A second live card with the
  // same details is a real cost, so say so rather than issuing it.
  const duplicate = findRecentDuplicate(result.value)
  if (duplicate) {
    return NextResponse.json(
      {
        message: `A card called "${duplicate.nickname}" with this limit was issued moments ago. Open it rather than issuing a second one.`,
        duplicateOf: duplicate.id,
      },
      { status: 409 },
    )
  }

  const { card, fullNumber } = createCard(result.value)

  return NextResponse.json(
    {
      card,
      // Shown once, on the success screen, and never persisted.
      reveal: { number: fullNumber },
      // Legal, but usually a misclick. A warning, not a rejection.
      warning: currencyMismatch(result.value),
    },
    { status: 201 },
  )
}
