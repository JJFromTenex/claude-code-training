import { cardById, canTransition, setCardStatus } from "@/data/cards"
import { CardStatus } from "@/data/types"
import { NextRequest, NextResponse } from "next/server"

const STATUSES: readonly CardStatus[] = ["active", "frozen", "cancelled"]

/**
 * Status transitions only — freeze, unfreeze, cancel. The state machine is
 * enforced here, not just in the UI, so a stale client can't reactivate a
 * cancelled card.
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

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 })
  }

  const status = (body as Record<string, unknown>)?.status
  if (typeof status !== "string" || !STATUSES.includes(status as CardStatus)) {
    return NextResponse.json(
      { error: "status must be one of active, frozen, cancelled." },
      { status: 400 },
    )
  }

  if (!canTransition(card.status, status as CardStatus)) {
    return NextResponse.json(
      { error: `Cannot move a ${card.status} card to ${status}.` },
      { status: 409 },
    )
  }

  const updated = setCardStatus(id, status as CardStatus)
  return NextResponse.json({ card: updated })
}
