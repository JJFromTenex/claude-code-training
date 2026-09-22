import { cardById, setCardStatus } from "@/data/cards"
import { NextRequest, NextResponse } from "next/server"

/**
 * A single card.
 *
 * Both handlers return the stored record, which holds the last four and a
 * reference and never a full number.
 */

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const card = cardById(id)

  if (!card) {
    return NextResponse.json({ message: "No card with that id." }, { status: 404 })
  }

  return NextResponse.json({ card })
}

/**
 * Move a card through the status machine.
 *
 * The transition is guarded on the server, so `cancelled → active` is a 409
 * whether it comes from the console or from curl.
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
    return NextResponse.json(
      { message: "Expected a JSON body with a status." },
      { status: 400 },
    )
  }

  const status =
    typeof body === "object" && body !== null
      ? (body as Record<string, unknown>).status
      : undefined

  const result = setCardStatus(id, status)

  if (!result.ok) {
    const code =
      result.reason === "not_found" ? 404 : result.reason === "illegal" ? 409 : 400
    return NextResponse.json({ message: result.message }, { status: code })
  }

  return NextResponse.json({ card: result.card })
}
