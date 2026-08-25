import { cardById, isCardStatus, transitionCard } from "@/data/cards"
import { NextRequest, NextResponse } from "next/server"

/**
 * Move a card through the state machine: `active ⇄ frozen`, either to
 * `cancelled`, and `cancelled` is terminal.
 *
 * The guard is here, not only in the UI, so a stale tab cannot revive a
 * cancelled card. A rejected transition is a 409: the request was well formed,
 * the card's state is what refuses it.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const card = cardById(id)

  if (!card) {
    return NextResponse.json({ message: "No such card." }, { status: 404 })
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json(
      { message: "Expected a status to move to." },
      { status: 400 },
    )
  }

  const status = (body as { status?: unknown })?.status
  if (!isCardStatus(status)) {
    return NextResponse.json(
      { message: "Status must be active, frozen, or cancelled." },
      { status: 400 },
    )
  }

  const result = transitionCard(card, status)
  if (!result.ok) {
    return NextResponse.json({ message: result.message }, { status: 409 })
  }

  return NextResponse.json(result.value)
}
