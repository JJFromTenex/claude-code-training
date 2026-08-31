import { cardById, transitionCard } from "@/data/cards"
import { NextRequest, NextResponse } from "next/server"

const ACTIONS = ["freeze", "unfreeze", "cancel"] as const
type Action = (typeof ACTIONS)[number]

/**
 * Applies a status action to a card. The state machine is guarded here,
 * not only in the UI: cancelled is terminal, and an illegal transition is
 * a 409 no matter what the client claims.
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const body = await request.json().catch(() => null)
  const action = body?.action

  if (!ACTIONS.includes(action as Action)) {
    return NextResponse.json({ error: "Unknown action." }, { status: 400 })
  }

  const card = cardById(id)
  if (!card) {
    return NextResponse.json({ error: "Card not found." }, { status: 404 })
  }

  const updated = transitionCard(id, action as Action)
  if (!updated) {
    return NextResponse.json(
      { error: `A ${card.status} card cannot be ${action === "unfreeze" ? "unfrozen" : action === "freeze" ? "frozen" : "cancelled"}.` },
      { status: 409 },
    )
  }

  return NextResponse.json({ card: updated })
}
