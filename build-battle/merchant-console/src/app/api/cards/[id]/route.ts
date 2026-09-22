import { store } from "@/data/store"
import { CardStatus } from "@/data/types"
import { NextRequest, NextResponse } from "next/server"

const VALID_TRANSITIONS: Record<CardStatus, CardStatus[]> = {
  active: ["frozen", "cancelled"],
  frozen: ["active", "cancelled"],
  cancelled: [],
}

export function GET(_request: NextRequest, { params }: { params: { id: string } }) {
  const card = store.cards.find((c) => c.id === params.id)
  if (!card) {
    return NextResponse.json({ message: "Card not found" }, { status: 404 })
  }
  return NextResponse.json(card)
}

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  const card = store.cards.find((c) => c.id === params.id)
  if (!card) {
    return NextResponse.json({ message: "Card not found" }, { status: 404 })
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ message: "Invalid JSON" }, { status: 400 })
  }

  if (!body || typeof body !== "object") {
    return NextResponse.json({ message: "Request body required" }, { status: 400 })
  }

  const { status } = body as Record<string, unknown>

  if (!status || typeof status !== "string") {
    return NextResponse.json({ message: "status is required" }, { status: 400 })
  }

  const allowed = VALID_TRANSITIONS[card.status]
  if (!allowed.includes(status as CardStatus)) {
    return NextResponse.json(
      { message: `Cannot transition from ${card.status} to ${status}` },
      { status: 422 },
    )
  }

  card.status = status as CardStatus
  return NextResponse.json(card)
}
