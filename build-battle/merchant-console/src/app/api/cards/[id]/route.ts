import { cardById, updateCardStatus } from "@/data/cardQueries"
import { CardStatus } from "@/data/types"
import { NextRequest, NextResponse } from "next/server"

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const card = cardById(id)
  if (!card) {
    return NextResponse.json({ error: "Card not found." }, { status: 404 })
  }
  return NextResponse.json({ card })
}

const VALID_STATUSES: readonly CardStatus[] = ["active", "frozen", "cancelled"]

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const body = await request.json().catch(() => null)
  const status = (body as { status?: unknown } | null)?.status

  if (typeof status !== "string" || !VALID_STATUSES.includes(status as CardStatus)) {
    return NextResponse.json({ error: "Invalid status." }, { status: 422 })
  }

  const result = updateCardStatus(id, status as CardStatus)
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 409 })
  }

  return NextResponse.json({ card: result.card })
}
