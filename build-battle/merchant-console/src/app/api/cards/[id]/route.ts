import { setCardStatus } from "@/data/cards"
import { CardStatus } from "@/data/types"
import { NextRequest, NextResponse } from "next/server"

const VALID_STATUSES: CardStatus[] = ["active", "frozen", "cancelled"]

/**
 * Transitions a card's status: active <-> frozen, either -> cancelled.
 * The transition table itself lives in data/cards.ts and is enforced there,
 * not just in the UI that calls this.
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const body = await request.json().catch(() => null)
  const status = (body as { status?: unknown } | null)?.status

  if (typeof status !== "string" || !VALID_STATUSES.includes(status as CardStatus)) {
    return NextResponse.json(
      { error: "Status must be active, frozen, or cancelled." },
      { status: 400 },
    )
  }

  const result = setCardStatus(id, status as CardStatus)
  if ("error" in result) {
    return NextResponse.json({ error: result.error }, { status: 400 })
  }

  return NextResponse.json({ card: result.card })
}
