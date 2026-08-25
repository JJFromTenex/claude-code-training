import { setCardStatus } from "@/data/cards"
import { CARD_STATUSES } from "@/lib/cards"
import { CardStatus } from "@/data/types"
import { NextRequest, NextResponse } from "next/server"

/**
 * Move a card's status.
 *
 * The transition table is the authority and it lives on the server, so a stale
 * tab offering "Unfreeze" on a cancelled card gets a 409 rather than a revival.
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
    return NextResponse.json(
      { message: "Expected a JSON body." },
      { status: 400 },
    )
  }

  const next = (body as { status?: unknown } | null)?.status
  if (!CARD_STATUSES.includes(next as CardStatus)) {
    return NextResponse.json(
      { message: "Status must be active, frozen, or cancelled." },
      { status: 400 },
    )
  }

  const result = setCardStatus(id, next as CardStatus)
  if ("error" in result) {
    return NextResponse.json(
      { message: result.error },
      { status: result.status },
    )
  }

  return NextResponse.json({ card: result.card })
}
