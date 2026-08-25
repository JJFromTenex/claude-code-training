import { setCardStatus } from "@/data/cards"
import { CardStatus } from "@/data/types"
import { NextRequest, NextResponse } from "next/server"

const STATUSES: readonly CardStatus[] = ["active", "frozen", "cancelled"]

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const body = await request.json().catch(() => null)
  const status =
    body && typeof body === "object" ? (body as Record<string, unknown>).status : undefined

  if (typeof status !== "string" || !STATUSES.includes(status as CardStatus)) {
    return NextResponse.json(
      { message: "Choose a valid status." },
      { status: 400 },
    )
  }

  const result = setCardStatus(id, status as CardStatus)
  if (!result.ok) {
    return NextResponse.json(
      { message: result.message },
      { status: result.status },
    )
  }

  return NextResponse.json({ card: result.card })
}
