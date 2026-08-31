import { cardById, isCardStatus, transitionCardStatus } from "@/data/cards"
import { Card } from "@/data/types"
import { maskCardNumber } from "@/lib/cards"
import { NextResponse } from "next/server"

function toMasked(card: Card) {
  return { ...card, maskedNumber: maskCardNumber(card.last4) }
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const card = cardById(id)

  if (!card) {
    return NextResponse.json({ message: "Card not found" }, { status: 404 })
  }

  return NextResponse.json(toMasked(card))
}

/** Freeze/unfreeze/cancel. The transition is guarded in transitionCardStatus. */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params

  if (!cardById(id)) {
    return NextResponse.json({ message: "Card not found" }, { status: 404 })
  }

  const body = await request.json().catch(() => null)
  const status = isRecordWithStatus(body) ? body.status : undefined

  if (!isCardStatus(status)) {
    return NextResponse.json(
      { message: "Status must be active, frozen, or cancelled" },
      { status: 400 },
    )
  }

  const result = transitionCardStatus(id, status)
  if (!result.ok) {
    return NextResponse.json({ message: result.message }, { status: 400 })
  }

  return NextResponse.json(toMasked(result.card))
}

function isRecordWithStatus(
  value: unknown,
): value is { status: unknown } {
  return typeof value === "object" && value !== null && "status" in value
}
