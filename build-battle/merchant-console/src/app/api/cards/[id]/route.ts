import { cardById, parseCardStatus, transitionCard } from "@/data/cards"
import { NextRequest, NextResponse } from "next/server"

type Context = { params: Promise<{ id: string }> }

export async function GET(_request: NextRequest, { params }: Context) {
  const { id } = await params
  const card = cardById(id)
  if (!card) return NextResponse.json({ error: "Card not found." }, { status: 404 })
  return NextResponse.json({ card })
}

/** Freeze, unfreeze, or cancel. The state machine is enforced here. */
export async function PATCH(request: NextRequest, { params }: Context) {
  const { id } = await params

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Request body must be JSON." }, { status: 400 })
  }

  const status = parseCardStatus(
    typeof body === "object" && body !== null ? (body as { status?: unknown }).status : undefined,
  )
  if (!status) {
    return NextResponse.json(
      { error: "Status must be active, frozen, or cancelled." },
      { status: 400 },
    )
  }

  const result = transitionCard(id, status)
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status })
  }
  return NextResponse.json({ card: result.card })
}
