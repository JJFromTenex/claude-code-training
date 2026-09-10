import { cardById, setCardStatus } from "@/data/card-queries"
import { CardStatus } from "@/data/types"
import { NextRequest, NextResponse } from "next/server"

const TARGET_STATUSES: readonly CardStatus[] = ["active", "frozen", "cancelled"]

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

/** Freeze, unfreeze, or cancel. The transition itself is guarded server-side. */
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
      { message: "Send the new status as JSON." },
      { status: 400 },
    )
  }

  const status = (body as { status?: unknown })?.status
  if (!TARGET_STATUSES.includes(status as CardStatus)) {
    return NextResponse.json(
      { message: "Status must be active, frozen, or cancelled." },
      { status: 400 },
    )
  }

  const result = setCardStatus(id, status as CardStatus)
  if (!result.ok) {
    return NextResponse.json({ message: result.message }, { status: result.status })
  }

  return NextResponse.json({ card: result.card })
}
