import { canTransition, cardById, transitionCard } from "@/data/cards"
import { CardStatus } from "@/data/types"
import { NextRequest, NextResponse } from "next/server"

const VALID_STATUSES: readonly CardStatus[] = ["active", "frozen", "cancelled"]

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const card = cardById(id)
  if (!card) {
    return NextResponse.json({ errors: ["Card not found."] }, { status: 404 })
  }
  return NextResponse.json({ card })
}

/** Freeze, unfreeze, or cancel. The state machine is enforced here, not by the client. */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const card = cardById(id)
  if (!card) {
    return NextResponse.json({ errors: ["Card not found."] }, { status: 404 })
  }

  const body = await request.json().catch(() => ({}))
  const status = body?.status as CardStatus | undefined
  if (!status || !VALID_STATUSES.includes(status)) {
    return NextResponse.json({ errors: ["Status must be active, frozen, or cancelled."] }, { status: 400 })
  }

  if (!canTransition(card.status, status)) {
    return NextResponse.json(
      { errors: [`Cannot move a ${card.status} card to ${status}.`] },
      { status: 409 },
    )
  }

  return NextResponse.json({ card: transitionCard(id, status) })
}
