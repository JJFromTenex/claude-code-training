import { cardById, transitionCard } from "@/data/cards"
import { NextRequest, NextResponse } from "next/server"

/** One card, masked. The full number is not readable after creation. */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const card = cardById(id)
  if (!card) {
    return NextResponse.json({ message: "Card not found." }, { status: 404 })
  }
  return NextResponse.json({ card })
}

/**
 * Freeze, unfreeze, or cancel. The state machine is enforced here rather
 * than in the UI; cancelled is terminal.
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ message: "Send a JSON body." }, { status: 400 })
  }

  const status =
    typeof body === "object" && body !== null
      ? (body as Record<string, unknown>).status
      : undefined

  const result = transitionCard(id, status)
  if ("error" in result) {
    return NextResponse.json(
      { message: result.error.message },
      { status: result.error.status },
    )
  }
  return NextResponse.json({ card: result.card })
}
