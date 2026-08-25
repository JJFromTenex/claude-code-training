import { applyTransition, cardById, replaceCard } from "@/data/cards"
import { CardStatus } from "@/data/types"
import { NextRequest, NextResponse } from "next/server"

/**
 * Changes a card's status. Guarded here rather than only in the UI: hiding a
 * button stops a click, not a request.
 */

const STATUSES: readonly CardStatus[] = ["active", "frozen", "cancelled"]

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json(
      { message: "Request body must be JSON." },
      { status: 400 },
    )
  }

  const status = (body as Record<string, unknown>)?.status as CardStatus
  if (!STATUSES.includes(status)) {
    return NextResponse.json(
      { message: "Status must be one of active, frozen, or cancelled." },
      { status: 400 },
    )
  }

  const card = cardById(id)
  if (!card) {
    return NextResponse.json({ message: "No such card." }, { status: 404 })
  }

  const updated = applyTransition(card, status, new Date().toISOString())
  if (!updated) {
    return NextResponse.json(
      {
        // From active or frozen the only refused move is to the status the
        // card already holds; everything else out of them is legal.
        message:
          card.status === "cancelled"
            ? "A cancelled card is cancelled for good and cannot be reopened."
            : `This card is already ${status}.`,
      },
      { status: 409 },
    )
  }

  replaceCard(updated)
  return NextResponse.json({ card: updated }, { status: 200 })
}
