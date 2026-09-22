import { cardById, parseCardStatus, transitionCard } from "@/data/cards"
import { NextRequest, NextResponse } from "next/server"

/** One card, masked. */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const card = cardById(id)
  if (!card) {
    return NextResponse.json({ error: "Card not found." }, { status: 404 })
  }
  return NextResponse.json({ card })
}

/**
 * Changes a card's status. The state machine is enforced here rather than in
 * the UI: `active ⇄ frozen`, either to `cancelled`, and `cancelled` is final.
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
    return NextResponse.json({ error: "Expected a JSON body." }, { status: 400 })
  }

  const status = parseCardStatus(
    (body as Record<string, unknown> | null)?.status,
  )
  if (!status.ok) {
    return NextResponse.json({ error: status.error }, { status: 400 })
  }

  const result = transitionCard(id, status.value)
  if (!result.ok) {
    const missing = result.error === "Card not found."
    return NextResponse.json(
      { error: result.error },
      { status: missing ? 404 : 409 },
    )
  }

  return NextResponse.json({ card: result.value })
}
