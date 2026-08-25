import { cardById, setCardStatus } from "@/data/cards"
import { parseCardStatus } from "@/lib/cards"
import { NextRequest, NextResponse } from "next/server"

/**
 * A single card.
 *
 * PATCH moves it through the status state machine. The transition is checked
 * on the server, so a stale tab cannot unfreeze a cancelled card by asking
 * nicely. The record returned never carries a full number.
 */

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const card = cardById(id)
  if (!card) {
    return NextResponse.json({ error: "No such card." }, { status: 404 })
  }
  return NextResponse.json({ card })
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
    return NextResponse.json(
      { error: "Expected a JSON body." },
      { status: 400 },
    )
  }

  const status = parseCardStatus(
    (body as Record<string, unknown> | null)?.status,
  )
  if (!status) {
    return NextResponse.json(
      { error: "Status must be active, frozen, or cancelled." },
      { status: 400 },
    )
  }

  const result = setCardStatus(id, status)
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status })
  }

  return NextResponse.json({ card: result.card })
}
