import { cardById, transitionCard } from "@/data/cards"
import { isCardStatus, maskCard } from "@/lib/cards"
import { NextRequest, NextResponse } from "next/server"

/**
 * One card. Neither method ever returns a full number.
 *
 * PATCH is the guarded edge of the status machine: the UI only offers legal
 * transitions, and this refuses the rest regardless of what it was sent.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const card = cardById(id)
  if (!card) {
    return NextResponse.json({ message: "No such card." }, { status: 404 })
  }
  return NextResponse.json({ card: maskCard(card) })
}

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

  const status = (body as Record<string, unknown>)?.status
  if (typeof status !== "string" || !isCardStatus(status)) {
    return NextResponse.json(
      { message: "Status must be active, frozen, or cancelled." },
      { status: 422 },
    )
  }

  const result = transitionCard(id, status)
  if (!result.ok) {
    return NextResponse.json(
      { message: result.message },
      { status: result.reason === "not_found" ? 404 : 409 },
    )
  }

  return NextResponse.json({ card: maskCard(result.card) })
}
