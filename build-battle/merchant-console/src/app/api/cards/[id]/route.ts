import { cardById } from "@/data/queries"
import { canTransition, isCardStatus } from "@/lib/cards"
import { NextRequest, NextResponse } from "next/server"

/**
 * A single card. Neither verb can return a full number, because the record
 * does not carry one.
 */

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const card = cardById(id)
  if (!card) {
    return NextResponse.json({ message: "No such card." }, { status: 404 })
  }
  return NextResponse.json({ card })
}

/**
 * Status transitions. The state machine is enforced here rather than in the
 * UI: `active ⇄ frozen`, either to `cancelled`, and `cancelled` is terminal.
 */
export async function PATCH(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const card = cardById(id)
  if (!card) {
    return NextResponse.json({ message: "No such card." }, { status: 404 })
  }

  let body: unknown
  try {
    body = await _request.json()
  } catch {
    return NextResponse.json({ message: "Expected a JSON body." }, { status: 400 })
  }

  const next = (body as Record<string, unknown> | null)?.status
  if (!isCardStatus(next)) {
    return NextResponse.json(
      { message: "Status must be one of active, frozen, or cancelled." },
      { status: 400 },
    )
  }

  if (!canTransition(card.status, next)) {
    const reason =
      card.status === "cancelled"
        ? "This card is cancelled, and cancelled is final."
        : `A card cannot go from ${card.status} to ${next}.`
    return NextResponse.json({ message: reason }, { status: 409 })
  }

  card.events.push({ at: new Date().toISOString(), from: card.status, to: next })
  card.status = next

  return NextResponse.json({ card })
}
