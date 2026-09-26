import { store } from "@/data/store"
import { NextResponse } from "next/server"

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const card = store.cards.find((c) => c.id === id)

  if (!card) {
    return NextResponse.json(
      { error: "Card not found" },
      { status: 404 },
    )
  }

  // Return card without full number (always masked after creation)
  return NextResponse.json(card)
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params

  const card = store.cards.find((c) => c.id === id)

  if (!card) {
    return NextResponse.json(
      { error: "Card not found" },
      { status: 404 },
    )
  }

  try {
    const body = await request.json()
    const { status } = body

    if (!status) {
      return NextResponse.json(
        { error: "Status is required" },
        { status: 400 },
      )
    }

    // Validate state machine
    if (card.status === "cancelled") {
      return NextResponse.json(
        { error: "Cannot change a cancelled card" },
        { status: 400 },
      )
    }

    if (status === "frozen") {
      if (card.status !== "active") {
        return NextResponse.json(
          { error: "Only active cards can be frozen" },
          { status: 400 },
        )
      }
    } else if (status === "active") {
      if (card.status !== "frozen") {
        return NextResponse.json(
          { error: "Only frozen cards can be reactivated" },
          { status: 400 },
        )
      }
    } else if (status === "cancelled") {
      if (!["active", "frozen"].includes(card.status)) {
        return NextResponse.json(
          { error: "Only active or frozen cards can be cancelled" },
          { status: 400 },
        )
      }
    } else {
      return NextResponse.json(
        { error: "Invalid status" },
        { status: 400 },
      )
    }

    card.status = status
    return NextResponse.json(card)
  } catch (error) {
    return NextResponse.json(
      { error: "Invalid request" },
      { status: 400 },
    )
  }
}
