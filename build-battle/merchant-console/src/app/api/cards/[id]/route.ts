import { getCard, transitionCard } from "@/data/cards"
import { CardStatus } from "@/data/types"
import { NextRequest, NextResponse } from "next/server"

const STATUSES: readonly CardStatus[] = ["active", "frozen", "cancelled"]

export async function GET(_request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params
  const card = getCard(id)
  if (!card) return NextResponse.json({ error: "Card not found." }, { status: 404 })
  return NextResponse.json({ card })
}

/** Status change, guarded by the state machine on the server. */
export async function PATCH(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Request body must be JSON." }, { status: 400 })
  }

  const to = (body as { status?: unknown } | null)?.status
  if (typeof to !== "string" || !STATUSES.includes(to as CardStatus)) {
    return NextResponse.json({ error: "Status must be active, frozen, or cancelled." }, { status: 400 })
  }

  const result = transitionCard(id, to as CardStatus)
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status })
  return NextResponse.json({ card: result.card })
}
