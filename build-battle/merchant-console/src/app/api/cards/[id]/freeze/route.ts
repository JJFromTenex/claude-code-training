import { store } from "@/data/store"
import { CardStatus } from "@/data/types"
import { NextResponse } from "next/server"

/**
 * PATCH /api/cards/:id/freeze — Freeze or unfreeze a card
 */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const { action } = (await request.json()) as { action?: string }

  if (!action || !["freeze", "unfreeze"].includes(action)) {
    return NextResponse.json({ error: "Action must be 'freeze' or 'unfreeze'" }, { status: 400 })
  }

  const card = store.cards.find((c) => c.id === id)
  if (!card) {
    return NextResponse.json({ error: "Card not found" }, { status: 404 })
  }

  // Validate state machine transitions
  const nextStatus: CardStatus = action === "freeze" ? "frozen" : "active"

  // active → frozen, frozen → active
  const validTransition =
    (card.status === "active" && nextStatus === "frozen") ||
    (card.status === "frozen" && nextStatus === "active")

  if (!validTransition) {
    return NextResponse.json(
      {
        error: `Cannot transition from ${card.status} to ${nextStatus}. Cancelled cards are terminal.`,
      },
      { status: 400 },
    )
  }

  card.status = nextStatus

  return NextResponse.json(card)
}
