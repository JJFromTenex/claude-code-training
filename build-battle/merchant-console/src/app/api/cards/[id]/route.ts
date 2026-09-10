import { cardById } from "@/data/cards"
import { CardStatus } from "@/data/types"
import { recordTransition, transition } from "@/lib/cards"
import { NextRequest, NextResponse } from "next/server"

const STATUSES: readonly CardStatus[] = ["active", "frozen", "cancelled"]

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const card = cardById(id)
  if (!card) {
    return NextResponse.json({ message: "Card not found." }, { status: 404 })
  }
  return NextResponse.json({ card })
}

/**
 * Changes a card's status.
 *
 * The state machine is guarded here rather than only in the UI: a cancelled
 * card cannot be revived by a crafted request.
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const card = cardById(id)
  if (!card) {
    return NextResponse.json({ message: "Card not found." }, { status: 404 })
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json(
      { message: "Expected a JSON body." },
      { status: 400 },
    )
  }

  const requested = (body as { status?: unknown })?.status
  if (
    typeof requested !== "string" ||
    !STATUSES.includes(requested as CardStatus)
  ) {
    return NextResponse.json(
      { message: "Status must be active, frozen, or cancelled." },
      { status: 400 },
    )
  }

  const result = transition(card.status, requested as CardStatus)
  if (!result.ok) {
    // The request was understood and refused by the state machine.
    return NextResponse.json({ message: result.message }, { status: 409 })
  }

  card.status = result.value
  recordTransition(card, result.value, new Date())
  return NextResponse.json({ card })
}
