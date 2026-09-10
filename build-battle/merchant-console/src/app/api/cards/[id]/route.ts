import { cardById, transitionCard } from "@/data/cards"
import { CardStatus } from "@/data/types"
import { CARD_TRANSITIONS, canTransition } from "@/lib/cards"
import { NextRequest, NextResponse } from "next/server"

/** Derived from the transition table so there is one list of statuses, not two. */
const CARD_STATUSES = Object.keys(CARD_TRANSITIONS) as CardStatus[]

/**
 * Updates a card's status. The state machine is guarded here, on the
 * server — canTransition is the single source of truth, not the UI.
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const card = cardById(id)
  if (!card) {
    return NextResponse.json({ message: "Card not found." }, { status: 404 })
  }

  let body
  try {
    body = await request.json()
  } catch {
    return NextResponse.json(
      { message: "Request body must be valid JSON." },
      { status: 400 },
    )
  }

  const { status } = body ?? {}

  if (!CARD_STATUSES.includes(status)) {
    return NextResponse.json(
      { message: "Unsupported status." },
      { status: 400 },
    )
  }

  if (!canTransition(card.status, status)) {
    return NextResponse.json(
      { message: `Cannot move a card from ${card.status} to ${status}.` },
      { status: 409 },
    )
  }

  const updated = transitionCard(id, status)
  return NextResponse.json({ card: updated }, { status: 200 })
}
