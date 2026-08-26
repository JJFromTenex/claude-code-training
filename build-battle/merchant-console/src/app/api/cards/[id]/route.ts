import { canTransitionCardStatus } from "@/data/cardStatus"
import { cardById } from "@/data/queries"
import { CardStatus } from "@/data/types"
import { NextRequest, NextResponse } from "next/server"

const CARD_STATUSES: readonly CardStatus[] = ["active", "frozen", "cancelled"]

interface UpdateCardBody {
  status?: unknown
}

/**
 * Freezes, unfreezes, or cancels a card. The transition is guarded here,
 * server-side, not just in the UI — the state machine is the enforcement.
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

  const body = (await request.json().catch(() => null)) as UpdateCardBody | null
  const status = body?.status
  if (typeof status !== "string" || !CARD_STATUSES.includes(status as CardStatus)) {
    return NextResponse.json(
      { message: "Status must be active, frozen, or cancelled." },
      { status: 400 },
    )
  }

  if (!canTransitionCardStatus(card.status, status as CardStatus)) {
    return NextResponse.json(
      { message: `Cannot move a card from ${card.status} to ${status}.` },
      { status: 409 },
    )
  }

  // `card` is the live array element `cardById` found, not a copy.
  card.status = status as CardStatus

  return NextResponse.json({ card })
}
