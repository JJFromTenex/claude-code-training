import { cardById, cardSpend, transitionCardStatus } from "@/data/cardQueries"
import { CARD_STATUSES } from "@/lib/cards"
import { NextRequest, NextResponse } from "next/server"

/**
 * `GET` returns one card, `PATCH` moves its status.
 *
 * The transition guard is here rather than only in the UI: `cancelled` is
 * terminal on the server, whatever a client sends.
 */

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const card = cardById(id)

  if (card === null) {
    return NextResponse.json({ message: "Card not found." }, { status: 404 })
  }

  return NextResponse.json({ card: { ...card, spent: cardSpend(card) } })
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ message: "Expected a JSON body." }, { status: 400 })
  }

  const requested = typeof body === "object" && body !== null
    ? Object(body).status
    : undefined
  const status = CARD_STATUSES.find((candidate) => candidate === requested)

  if (status === undefined) {
    return NextResponse.json(
      { message: "Status must be active, frozen, or cancelled." },
      { status: 400 },
    )
  }

  const result = transitionCardStatus(id, status)

  if (!result.ok) {
    if (result.reason === "not_found") {
      return NextResponse.json({ message: "Card not found." }, { status: 404 })
    }
    return NextResponse.json(
      {
        message: `Cannot move a card from ${result.card.status} to ${status}.`,
      },
      { status: 409 },
    )
  }

  return NextResponse.json({
    card: { ...result.card, spent: cardSpend(result.card) },
  })
}
