import { applyAction } from "@/data/cards"
import { CARD_ACTIONS, CardAction } from "@/lib/cards"
import { NextRequest, NextResponse } from "next/server"

const ACTIONS = Object.keys(CARD_ACTIONS) as CardAction[]

/**
 * The status machine is guarded here, not in the UI. The console hides the
 * buttons it should not offer; this is the thing that refuses.
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const body = await request.json().catch(() => null)
  const action = (body as { action?: unknown } | null)?.action

  if (typeof action !== "string" || !ACTIONS.includes(action as CardAction)) {
    return NextResponse.json(
      { message: `The action must be one of: ${ACTIONS.join(", ")}.` },
      { status: 400 },
    )
  }

  const result = applyAction(id, action as CardAction)
  if ("message" in result) {
    return NextResponse.json(
      { message: result.message },
      { status: result.status },
    )
  }

  return NextResponse.json({ card: result.card })
}
