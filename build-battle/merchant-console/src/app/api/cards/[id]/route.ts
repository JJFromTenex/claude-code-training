import { CARD_STATUSES, cardById, transitionCard } from "@/data/cards"
import { CardStatus } from "@/data/types"
import { NextRequest, NextResponse } from "next/server"

/** Moves a card through the state machine. The guard lives in the data layer. */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const card = cardById(id)
  if (!card) return NextResponse.json({ error: "No such card." }, { status: 404 })

  const body = await request.json().catch(() => null)
  const status = (body as { status?: unknown } | null)?.status as CardStatus
  if (!CARD_STATUSES.includes(status)) {
    return NextResponse.json(
      { error: "Status must be active, frozen, or cancelled." },
      { status: 400 },
    )
  }

  const result = transitionCard(card, status)
  if ("error" in result) return NextResponse.json({ error: result.error }, { status: 409 })
  return NextResponse.json({ card: result.card })
}
