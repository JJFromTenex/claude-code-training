import { isValidStatusTransition } from "@/lib/cards"
import { store } from "@/data/store"
import { CardStatus } from "@/data/types"
import { NextRequest, NextResponse } from "next/server"

const STATUSES: readonly CardStatus[] = ["active", "frozen", "cancelled"]

function findCard(id: string) {
  return store.cards.find((card) => card.id === id) ?? null
}

/** GET /api/cards/[id] — one card, or 404. Never a full number. */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const card = findCard(id)
  if (!card) {
    return NextResponse.json({ message: "Card not found." }, { status: 404 })
  }
  return NextResponse.json({ card })
}

/**
 * PATCH /api/cards/[id] — change status only.
 * The transition is guarded here, not only in the UI: a cancelled card can
 * never come back, and freeze/unfreeze is the only other legal move.
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const card = findCard(id)
  if (!card) {
    return NextResponse.json({ message: "Card not found." }, { status: 404 })
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ message: "Request body must be JSON." }, { status: 400 })
  }

  const status = (body as Record<string, unknown> | null)?.status
  if (typeof status !== "string" || !STATUSES.includes(status as CardStatus)) {
    return NextResponse.json(
      { message: "Status must be one of active, frozen, cancelled." },
      { status: 400 },
    )
  }

  if (!isValidStatusTransition(card.status, status as CardStatus)) {
    return NextResponse.json(
      { message: `Cannot move a card from ${card.status} to ${status}.` },
      { status: 400 },
    )
  }

  card.status = status as CardStatus
  return NextResponse.json({ card })
}
