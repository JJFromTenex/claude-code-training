import { store } from "@/data/store"
import { CardEventType, CardStatus } from "@/data/types"
import { canTransition } from "@/lib/cards"
import { NextRequest, NextResponse } from "next/server"

const ACTIONS: Record<string, { to: CardStatus; event: CardEventType }> = {
  freeze: { to: "frozen", event: "frozen" },
  unfreeze: { to: "active", event: "unfrozen" },
  cancel: { to: "cancelled", event: "cancelled" },
}

/**
 * PATCH applies a freeze/unfreeze/cancel action. The transition is guarded
 * here, on the server, regardless of what the UI already checked.
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const card = store.cards.find((c) => c.id === id)
  if (!card) {
    return NextResponse.json({ message: "Card not found." }, { status: 404 })
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json(
      { message: "Request body must be valid JSON." },
      { status: 400 },
    )
  }

  const action =
    typeof body === "object" && body !== null
      ? (body as Record<string, unknown>).action
      : undefined

  if (typeof action !== "string" || !(action in ACTIONS)) {
    return NextResponse.json(
      { message: "Action must be one of freeze, unfreeze, cancel." },
      { status: 400 },
    )
  }

  const { to, event } = ACTIONS[action]
  if (!canTransition(card.status, to)) {
    return NextResponse.json(
      { message: `Cannot ${action} a ${card.status} card.` },
      { status: 409 },
    )
  }

  card.status = to
  card.events.push({ type: event, at: new Date().toISOString() })

  return NextResponse.json(card)
}
