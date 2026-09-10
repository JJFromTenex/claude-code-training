import { cardById, transitionCard } from "@/data/cards"
import { Card, CardStatus } from "@/data/types"
import { parseStatusInput } from "@/lib/cards"
import { NextRequest, NextResponse } from "next/server"

/**
 * One card. GET returns the masked record; PATCH moves it through the status
 * state machine. The transition is guarded here, on the server, so the
 * buttons in the UI are a convenience and not the enforcement.
 */

type Context = { params: Promise<{ id: string }> }

const notFound = () =>
  NextResponse.json({ error: "No card with that id." }, { status: 404 })

export async function GET(_request: NextRequest, { params }: Context) {
  const { id } = await params
  const card = cardById(id)
  if (!card) return notFound()
  return NextResponse.json({ card })
}

/** A sentence ops can read, for the one transition the state machine refuses. */
function refusal(card: Card, to: CardStatus): string {
  if (card.status === "cancelled") {
    return "This card is cancelled. Cancelled cards cannot be changed."
  }
  if (card.status === to) return `This card is already ${to}.`
  return `A ${card.status} card cannot be made ${to}.`
}

export async function PATCH(request: NextRequest, { params }: Context) {
  const { id } = await params

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json(
      { error: "Request body must be JSON." },
      { status: 400 },
    )
  }

  const parsed = parseStatusInput(body)
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.error }, { status: 400 })
  }

  const result = transitionCard(id, parsed.value)
  if (!result.ok) {
    if (result.reason === "not_found") return notFound()
    return NextResponse.json(
      { error: refusal(result.card, parsed.value) },
      { status: 409 },
    )
  }

  return NextResponse.json({ card: result.card })
}
