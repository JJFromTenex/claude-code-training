import { IllegalStatusTransitionError, setCardStatus } from "@/data/cards"
import { CardStatus } from "@/data/types"
import { NextResponse } from "next/server"

const STATUSES: readonly CardStatus[] = ["active", "frozen", "cancelled"]

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params

  const body = await request.json().catch(() => null)
  const status = body && typeof body === "object" ? (body as Record<string, unknown>).status : null

  if (typeof status !== "string" || !STATUSES.includes(status as CardStatus)) {
    return NextResponse.json({ message: "Unknown card status" }, { status: 400 })
  }

  try {
    const card = setCardStatus(id, status as CardStatus)
    if (!card) {
      return NextResponse.json({ message: "Card not found" }, { status: 404 })
    }
    return NextResponse.json(card)
  } catch (error) {
    if (error instanceof IllegalStatusTransitionError) {
      return NextResponse.json({ message: error.message }, { status: 400 })
    }
    throw error
  }
}
