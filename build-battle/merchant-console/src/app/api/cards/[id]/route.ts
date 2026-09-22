import { cardById } from "@/data/queries"
import { checkTransition } from "@/lib/cards"
import { NextRequest, NextResponse } from "next/server"

/**
 * Change a card's status.
 *
 * The state machine is guarded here rather than in the UI: `active ⇄ frozen`,
 * either to `cancelled`, and nothing leaves `cancelled`.
 */

const error = (message: string, status: number) =>
  NextResponse.json({ message }, { status })

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const card = cardById(id)
  if (!card) return error("Card not found.", 404)

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return error("Expected a JSON body.", 400)
  }

  const { status } = (body ?? {}) as { status?: unknown }

  const checked = checkTransition(card.status, status)
  if (!checked.ok) return error(checked.message, 400)

  card.status = checked.status
  return NextResponse.json({ card })
}
