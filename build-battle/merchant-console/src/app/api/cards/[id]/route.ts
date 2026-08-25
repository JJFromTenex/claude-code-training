import { cardById, transitionCard } from "@/data/cards"
import { NextRequest, NextResponse } from "next/server"

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const card = cardById(id)
  if (!card) {
    return NextResponse.json({ message: "Card not found." }, { status: 404 })
  }
  // `card` holds last4 only. There is no full number to withhold.
  return NextResponse.json({ card })
}

/**
 * Move a card between statuses. The state machine is guarded in
 * `transitionCard`, on the server — the UI hiding a button is not enforcement.
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params

  let body: { status?: unknown }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json(
      { message: "Expected a JSON body." },
      { status: 400 },
    )
  }

  const result = transitionCard(id, body?.status)
  if (!result.ok) {
    return NextResponse.json(
      { message: result.message },
      { status: result.status },
    )
  }

  return NextResponse.json({ card: result.card })
}
