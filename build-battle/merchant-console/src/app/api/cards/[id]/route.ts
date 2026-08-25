import { cardById, setCardStatus } from "@/data/cards"
import { CardStatus } from "@/data/types"
import { NextRequest, NextResponse } from "next/server"

const ALLOWED_STATUSES: readonly CardStatus[] = ["active", "frozen", "cancelled"]

/** Masked view. Never the full number. */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const card = cardById(id)

  if (!card) {
    return NextResponse.json(
      { message: "That card does not exist." },
      { status: 404 },
    )
  }

  return NextResponse.json({ card })
}

/** Move a card through the state machine. The transition is guarded server-side. */
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

  const status = (body as { status?: unknown })?.status
  if (!ALLOWED_STATUSES.includes(status as CardStatus)) {
    return NextResponse.json(
      { message: "Status must be active, frozen, or cancelled." },
      { status: 400 },
    )
  }

  const result = setCardStatus(id, status as CardStatus)
  if (!result.ok) {
    return NextResponse.json(
      { message: result.message },
      { status: result.reason === "not_found" ? 404 : 409 },
    )
  }

  return NextResponse.json({ card: result.card })
}
