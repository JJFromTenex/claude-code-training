import { cardById, setCardStatus } from "@/data/cards"
import { CardStatus } from "@/data/types"
import { NextRequest, NextResponse } from "next/server"

const STATUSES: readonly CardStatus[] = ["active", "frozen", "cancelled"]

/** GET /api/cards/[id] — one card, masked. Never includes the full number. */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const card = cardById(id)
  if (!card) {
    return NextResponse.json({ message: "Card not found." }, { status: 404 })
  }
  return NextResponse.json(card)
}

/**
 * PATCH /api/cards/[id] — change status. The state machine is enforced here on
 * the server (active ⇄ frozen, either → cancelled, cancelled terminal), not
 * only in the UI. 404 for an unknown card, 409 for an illegal transition.
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params

  let body: Record<string, unknown>
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ message: "Request body must be JSON." }, { status: 400 })
  }

  const status = body.status
  if (typeof status !== "string" || !STATUSES.includes(status as CardStatus)) {
    return NextResponse.json(
      { message: "Status must be one of active, frozen, cancelled." },
      { status: 400 },
    )
  }

  const result = setCardStatus(id, status as CardStatus)
  if (!result.ok) {
    if (result.reason === "not_found") {
      return NextResponse.json({ message: "Card not found." }, { status: 404 })
    }
    return NextResponse.json(
      { message: "That status change is not allowed." },
      { status: 409 },
    )
  }
  return NextResponse.json(result.card)
}
