import { cardById, spendForCard } from "@/data/queries"
import { CardStatus } from "@/data/types"
import { canTransition } from "@/lib/cards"
import { NextRequest, NextResponse } from "next/server"

/**
 * Card detail + status transitions.
 *
 * GET   — full record (no full number) plus current spend in minor units.
 * PATCH — { status } transition, validated on the server against the state
 *         machine. Any other body key is ignored: editing the limit is
 *         NWP-202, not this ticket.
 */

const STATUSES: readonly CardStatus[] = ["active", "frozen", "cancelled"]

function bad(message: string, status = 400) {
  return NextResponse.json({ message }, { status })
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const card = cardById(id)
  if (!card) return bad("Card not found", 404)
  return NextResponse.json({ card, spend: spendForCard(card) })
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const card = cardById(id)
  if (!card) return bad("Card not found", 404)

  let body: { status?: unknown }
  try {
    body = await request.json()
  } catch {
    return bad("Body must be JSON")
  }

  const next = body.status
  if (typeof next !== "string" || !STATUSES.includes(next as CardStatus)) {
    return bad("Status must be active, frozen, or cancelled")
  }

  if (!canTransition(card.status, next as CardStatus)) {
    return bad(
      `Cannot transition from ${card.status} to ${next}`,
      409,
    )
  }

  card.status = next as CardStatus
  return NextResponse.json({ card, spend: spendForCard(card) })
}
