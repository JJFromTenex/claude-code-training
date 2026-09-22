import { cardById, changeCardStatus, parseCardStatus } from "@/data/cards"
import { NextRequest, NextResponse } from "next/server"

type Context = { params: Promise<{ id: string }> }

export async function GET(_request: NextRequest, { params }: Context) {
  const { id } = await params
  const card = cardById(id)
  if (!card) {
    return NextResponse.json({ message: "Card not found." }, { status: 404 })
  }
  return NextResponse.json(card)
}

/** Status transitions only. The limit is not editable after issue (NWP-202). */
export async function PATCH(request: NextRequest, { params }: Context) {
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

  const parsed = parseCardStatus(body)
  if (!parsed.ok) {
    return NextResponse.json({ message: parsed.message }, { status: 400 })
  }

  const result = changeCardStatus(id, parsed.value)
  if (!result.ok) {
    return NextResponse.json(
      { message: result.message },
      { status: result.status },
    )
  }
  return NextResponse.json(result.card)
}
