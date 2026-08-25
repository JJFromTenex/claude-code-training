import { CARD_STATUSES } from "@/lib/cards"
import { cardById, setCardStatus } from "@/data/queries"
import { CardStatus } from "@/data/types"
import { NextRequest, NextResponse } from "next/server"

/**
 * Freezes, unfreezes, or cancels a card. The transition is guarded on the
 * server by `setCardStatus()` — an illegal move (e.g. reviving a cancelled
 * card) is a 409, not a 200 that silently does nothing.
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params

  if (!cardById(id)) {
    return NextResponse.json({ message: "Card not found." }, { status: 404 })
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ message: "Invalid request body." }, { status: 400 })
  }

  const status = (body as { status?: unknown })?.status
  if (!CARD_STATUSES.includes(status as CardStatus)) {
    return NextResponse.json({ message: "Unknown status." }, { status: 400 })
  }

  const result = setCardStatus(id, status as CardStatus)
  if (!result.ok) {
    return NextResponse.json({ message: result.error }, { status: 409 })
  }

  return NextResponse.json({ card: result.card })
}
