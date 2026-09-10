import { cardById, setCardStatus } from "@/data/cards"
import { NextRequest, NextResponse } from "next/server"

/**
 * A single card. Neither handler can return a full number: the record it
 * serialises has never held one.
 */

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const card = cardById(id)
  if (!card) {
    return NextResponse.json({ error: "No card with that id." }, { status: 404 })
  }
  return NextResponse.json({ card })
}

/**
 * The status state machine, enforced. The console hides the buttons it should
 * not offer, but this is what refuses a request that skips the console.
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
    return NextResponse.json({ error: "Expected a JSON body." }, { status: 400 })
  }

  const status = (body as { status?: unknown } | null)?.status
  const result = setCardStatus(id, status)
  if (!result.ok) {
    return NextResponse.json(
      { error: result.error, field: result.field },
      { status: result.status },
    )
  }

  return NextResponse.json({ card: result.value })
}
