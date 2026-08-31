import { cardById, setCardStatus } from "@/data/cards"
import { CardStatus } from "@/data/types"
import { CARD_STATUSES } from "@/lib/cards"
import { NextRequest, NextResponse } from "next/server"

/**
 * Read one card, or move it through the status machine.
 *
 * Neither response carries a full number — the record does not hold one. The
 * transition is guarded here rather than only in the UI, so a cancelled card
 * stays cancelled however the request arrives.
 */

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
      { message: "Expected a JSON body." },
      { status: 400 },
    )
  }

  const next = (body as Record<string, unknown> | null)?.status
  if (
    typeof next !== "string" ||
    !(CARD_STATUSES as readonly string[]).includes(next)
  ) {
    return NextResponse.json(
      { message: `Status must be one of ${CARD_STATUSES.join(", ")}.` },
      { status: 400 },
    )
  }

  const result = setCardStatus(id, next as CardStatus)
  if (!result.ok) {
    return NextResponse.json({ message: result.error }, { status: result.status })
  }
  return NextResponse.json({ card: result.card })
}
