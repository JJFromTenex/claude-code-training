import { cardById } from "@/data/queries"
import { CardStatus } from "@/data/types"
import { canTransition } from "@/lib/cards"
import { NextRequest, NextResponse } from "next/server"

const STATUSES: readonly CardStatus[] = ["active", "frozen", "cancelled"]

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const card = cardById(id)
  if (!card) {
    return NextResponse.json({ error: "Card not found." }, { status: 404 })
  }
  return NextResponse.json({ card })
}

/**
 * Freezes, unfreezes, or cancels a card. The transition is guarded here,
 * not only in the UI — see .claude/rules/cards.md. `cancelled` is terminal.
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
  const status = body?.status as CardStatus

  if (!STATUSES.includes(status)) {
    return NextResponse.json(
      { error: "Status must be one of active, frozen, or cancelled." },
      { status: 400 },
    )
  }
  if (!canTransition(card.status, status)) {
    return NextResponse.json(
      { error: `Cannot move a ${card.status} card to ${status}.` },
      { status: 400 },
    )
  }

  card.status = status
  card.history.push({ status, at: new Date().toISOString() })
  return NextResponse.json({ card })
}
