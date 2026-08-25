import { cardById } from "@/data/queries"
import { CardStatus } from "@/data/types"
import { canTransitionCard } from "@/lib/cards"
import { NextRequest, NextResponse } from "next/server"

const STATUSES: readonly CardStatus[] = ["active", "frozen", "cancelled"]

/**
 * Freeze, unfreeze, or cancel a card. The state machine is enforced here,
 * on the server, regardless of what the UI offers: active ⇄ frozen, either
 * to cancelled, and cancelled is terminal.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  let body: Record<string, unknown>
  try {
    body = await request.json()
  } catch {
    return NextResponse.json(
      { message: "Request body must be JSON." },
      { status: 400 },
    )
  }

  const next = body.status
  if (!STATUSES.includes(next as CardStatus)) {
    return NextResponse.json(
      { message: "Status must be active, frozen, or cancelled." },
      { status: 400 },
    )
  }

  const { id } = await params
  const card = cardById(id)
  if (!card) {
    return NextResponse.json({ message: "Card not found." }, { status: 404 })
  }

  if (!canTransitionCard(card.status, next as CardStatus)) {
    return NextResponse.json(
      { message: `A ${card.status} card cannot become ${next}.` },
      { status: 409 },
    )
  }

  card.status = next as CardStatus
  return NextResponse.json({ card })
}
