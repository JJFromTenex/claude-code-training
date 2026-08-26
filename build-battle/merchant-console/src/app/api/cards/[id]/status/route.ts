import { cardById, transitionCard } from "@/data/cards"
import { CardStatus } from "@/data/types"
import { NextRequest, NextResponse } from "next/server"

const STATUSES: readonly CardStatus[] = ["active", "frozen", "cancelled"]

/** Guarded on the server, not only in the UI. */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json(
      { message: "Expected a JSON body." },
      { status: 400 },
    )
  }

  const status = (body as { status?: unknown } | null)?.status
  if (!STATUSES.includes(status as CardStatus)) {
    return NextResponse.json(
      { message: `Status must be one of ${STATUSES.join(", ")}.` },
      { status: 400 },
    )
  }

  if (!cardById(id)) {
    return NextResponse.json(
      { message: "That card does not exist." },
      { status: 404 },
    )
  }

  const result = transitionCard(id, status as CardStatus)
  if (!result.ok) {
    return NextResponse.json({ message: result.message }, { status: 409 })
  }

  return NextResponse.json({ card: result.value })
}
