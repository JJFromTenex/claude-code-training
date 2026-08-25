import { cardById, updateCardStatus } from "@/data/cards"
import { canTransition, isCardStatus } from "@/lib/cards"
import { NextRequest, NextResponse } from "next/server"

/**
 * Moves a card through its status machine.
 *
 * active ⇄ frozen, either to cancelled, cancelled is terminal. The guard is
 * here rather than in the UI, because a hand-made request is the case that
 * matters.
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params

  const card = cardById(id)
  if (!card) {
    return NextResponse.json({ message: "No card with that id." }, { status: 404 })
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ message: "Send a JSON body." }, { status: 400 })
  }

  const status = (body as Record<string, unknown>).status
  if (!isCardStatus(status)) {
    return NextResponse.json(
      { message: "Status must be active, frozen, or cancelled." },
      { status: 400 },
    )
  }

  if (!canTransition(card.status, status)) {
    return NextResponse.json(
      {
        message:
          card.status === "cancelled"
            ? "A cancelled card cannot change status."
            : `A card cannot go from ${card.status} to ${status}.`,
      },
      { status: 409 },
    )
  }

  return NextResponse.json({ card: updateCardStatus(id, status) })
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const card = cardById(id)
  if (!card) {
    return NextResponse.json({ message: "No card with that id." }, { status: 404 })
  }
  return NextResponse.json({ card })
}
