import { cardById, updateCardStatus } from "@/data/cards"
import { canTransition, isValidCardStatus } from "@/lib/cards"
import { NextRequest, NextResponse } from "next/server"

/**
 * Status is a state machine: active ⇄ frozen, either → cancelled, and
 * cancelled is terminal. Guarded here, not only in the UI.
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const card = cardById(id)
  if (!card) {
    return NextResponse.json({ error: "Card not found." }, { status: 404 })
  }

  const body = await request.json().catch(() => null)
  if (!body || !isValidCardStatus(body.status)) {
    return NextResponse.json(
      { error: "Status must be active, frozen, or cancelled." },
      { status: 400 },
    )
  }

  if (!canTransition(card.status, body.status)) {
    return NextResponse.json(
      { error: `Cannot move a ${card.status} card to ${body.status}.` },
      { status: 409 },
    )
  }

  const updated = updateCardStatus(id, body.status)
  return NextResponse.json({ card: updated })
}
