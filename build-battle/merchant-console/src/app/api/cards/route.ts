import { issueCard, listCards } from "@/data/cards"
import { Card } from "@/data/types"
import { maskCardNumber } from "@/lib/cards"
import { NextRequest, NextResponse } from "next/server"

/** The masked display number, alongside the record. Never the full number. */
function toMasked(card: Card) {
  return { ...card, maskedNumber: maskCardNumber(card.last4) }
}

export function GET() {
  return NextResponse.json(listCards().map(toMasked))
}

/**
 * The only response in the app that ever carries a full card number. It is
 * generated here, returned once, and never written onto the stored record.
 */
export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null)
  const result = issueCard(body)

  if (!result.ok) {
    return NextResponse.json({ message: result.message }, { status: 400 })
  }

  return NextResponse.json(
    { card: toMasked(result.card), fullNumber: result.fullNumber },
    { status: 201 },
  )
}
