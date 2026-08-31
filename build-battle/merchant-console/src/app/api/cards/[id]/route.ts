import { cardById, setCardStatus } from "@/data/cards"
import { CardStatus } from "@/data/types"
import { NextRequest, NextResponse } from "next/server"

const VALID_STATUSES: readonly CardStatus[] = ["active", "frozen", "cancelled"]

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const card = cardById(id)
  if (!card) {
    return NextResponse.json({ error: "Card not found." }, { status: 404 })
  }
  return NextResponse.json({ card })
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const body = await request.json().catch(() => null)
  const status = (body as { status?: unknown } | null)?.status

  if (typeof status !== "string" || !VALID_STATUSES.includes(status as CardStatus)) {
    return NextResponse.json(
      { error: "status must be one of active, frozen, cancelled." },
      { status: 400 },
    )
  }

  const result = setCardStatus(id, status as CardStatus)
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status })
  }
  return NextResponse.json({ card: result.card })
}
