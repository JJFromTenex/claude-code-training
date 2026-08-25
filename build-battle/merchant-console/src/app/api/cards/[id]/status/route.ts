import { setCardStatus } from "@/data/cards"
import { NextRequest, NextResponse } from "next/server"

/**
 * Moves a card through the status state machine.
 *
 * The transition is enforced here, not in the UI: a request that tries to
 * revive a cancelled card is refused whether or not a button was disabled
 * (`.claude/rules/cards.md`).
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
    return NextResponse.json({ message: "Send a JSON body." }, { status: 400 })
  }

  const next = (body as { status?: unknown } | null)?.status
  const result = setCardStatus(id, next)

  if (!result.ok) {
    return NextResponse.json({ message: result.message }, { status: result.status })
  }

  return NextResponse.json({ card: result.card })
}
