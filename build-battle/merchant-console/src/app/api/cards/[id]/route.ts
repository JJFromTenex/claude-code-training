import { isCardStatus } from "@/data/cardRules"
import { cardById, changeCardStatus } from "@/data/cards"
import { apiError as error } from "@/lib/apiError"
import { NextRequest, NextResponse } from "next/server"

type Params = { params: Promise<{ id: string }> }

export async function GET(_request: NextRequest, { params }: Params) {
  const card = cardById((await params).id)
  if (!card) return error(404, "No card with that id.")
  return NextResponse.json({ card })
}

/** Changes status. The transition is checked here, not trusted from the UI. */
export async function PATCH(request: NextRequest, { params }: Params) {
  const { id } = await params

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return error(400, "Request body must be JSON.")
  }

  const status = (body as { status?: unknown } | null)?.status
  if (!isCardStatus(status)) {
    return error(400, "Status must be active, frozen, or cancelled.")
  }

  const result = changeCardStatus(id, status)
  if (result.status === "not_found") return error(404, "No card with that id.")
  if (result.status === "invalid_transition") {
    return error(
      409,
      result.from === "cancelled"
        ? "Cancelled cards cannot be reactivated."
        : `A ${result.from} card cannot be set to ${status}.`,
    )
  }

  return NextResponse.json({ card: result.card })
}
