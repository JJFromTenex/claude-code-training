import { transitionCard } from "@/data/cards"
import { isCardStatus } from "@/lib/cards"
import { NextRequest, NextResponse } from "next/server"

/**
 * Moves a card through the state machine. The target status is allowlisted
 * and the transition is checked here, not in the UI.
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
    return NextResponse.json(
      { message: "Request body must be JSON." },
      { status: 400 },
    )
  }

  const status = (body as { status?: unknown } | null)?.status
  if (!isCardStatus(status)) {
    return NextResponse.json(
      { message: "Status must be active, frozen, or cancelled." },
      { status: 400 },
    )
  }

  const result = transitionCard(id, status)
  if (!result.ok) {
    return NextResponse.json(
      { message: result.message },
      { status: result.reason === "not_found" ? 404 : 409 },
    )
  }
  return NextResponse.json({ card: result.card })
}
