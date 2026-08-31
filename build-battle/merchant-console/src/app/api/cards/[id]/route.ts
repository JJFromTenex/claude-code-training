import { cardById, transitionCardStatus } from "@/data/cards"
import { NextRequest, NextResponse } from "next/server"

/** The card record: `last4` only, never the full number. */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const card = cardById(id)
  if (!card) {
    return NextResponse.json({ message: "No such card." }, { status: 404 })
  }
  return NextResponse.json(card)
}

/**
 * Move a card through the state machine. The server decides whether the
 * transition is legal; the UI only decides which buttons to draw.
 */
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

  if (typeof body !== "object" || body === null) {
    return NextResponse.json({ message: "Expected a JSON object." }, { status: 400 })
  }

  const result = transitionCardStatus(id, (body as { status?: unknown }).status)
  if (result === null) {
    return NextResponse.json({ message: "No such card." }, { status: 404 })
  }
  if (!result.ok) {
    return NextResponse.json(
      { field: result.error.field, message: result.error.message },
      { status: 400 },
    )
  }

  return NextResponse.json(result.value)
}
