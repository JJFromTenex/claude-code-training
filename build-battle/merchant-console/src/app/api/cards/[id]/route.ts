import { cardSpend, transitionCard } from "@/data/cards"
import { store } from "@/data/store"
import { CardStatus } from "@/data/types"
import { NextRequest, NextResponse } from "next/server"

const VALID_STATUSES = new Set<string>(["active", "frozen", "cancelled"])

export function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  return params.then(({ id }) => {
    const card = store.cards.find((c) => c.id === id)
    if (!card) {
      return NextResponse.json({ message: "Card not found." }, { status: 404 })
    }
    const spent = cardSpend(card)
    return NextResponse.json({ ...card, spent })
  })
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  let body: Record<string, unknown>
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ message: "Invalid JSON body." }, { status: 400 })
  }

  if (typeof body.status !== "string" || !VALID_STATUSES.has(body.status)) {
    return NextResponse.json(
      { message: `Invalid status ${body.status}.` },
      { status: 400 },
    )
  }

  const result = transitionCard(id, body.status as CardStatus)
  if ("error" in result) {
    return NextResponse.json(
      { message: result.error },
      { status: result.status },
    )
  }
  return NextResponse.json(result.card)
}
