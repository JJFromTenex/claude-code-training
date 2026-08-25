import {
  parseCardStatus,
  transitionCard,
  withSpend,
} from "@/data/card-queries"
import { NextRequest, NextResponse } from "next/server"

/**
 * Move a card through the state machine: active ⇄ frozen, either to cancelled,
 * and nothing out of cancelled. Guarded here rather than in the UI, so a
 * crafted request cannot revive a cancelled card.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ message: "That is not a card status." }, { status: 400 })
  }

  const parsed = parseCardStatus(body)
  if (!parsed.ok) {
    return NextResponse.json(
      { message: parsed.error.message, field: parsed.error.field },
      { status: 400 },
    )
  }

  const result = transitionCard(id, parsed.value)

  if (!result.ok && result.reason === "not_found") {
    return NextResponse.json({ message: "No card with that id." }, { status: 404 })
  }
  if (!result.ok) {
    const detail =
      result.from === "cancelled"
        ? "A cancelled card cannot be changed."
        : `Cannot move a card from ${result.from} to ${parsed.value}.`
    return NextResponse.json({ message: detail, field: "status" }, { status: 409 })
  }

  return NextResponse.json({ card: withSpend(result.card) })
}
