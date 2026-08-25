import { setCardStatus } from "@/data/cards"
import { CardStatus } from "@/data/types"
import { NextRequest } from "next/server"

/**
 * Transition a card's status. The target status is validated against the
 * allowlist and the state machine is enforced server-side
 * (`active ⇄ frozen`, either → `cancelled`, and `cancelled` is terminal).
 */

const STATUSES: readonly CardStatus[] = ["active", "frozen", "cancelled"]

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params

  let body: Record<string, unknown>
  try {
    body = await request.json()
  } catch {
    return Response.json({ message: "Invalid request body." }, { status: 400 })
  }

  const to = body.status
  if (!STATUSES.includes(to as CardStatus)) {
    return Response.json(
      { message: "Status must be active, frozen, or cancelled." },
      { status: 400 },
    )
  }

  const result = setCardStatus(id, to as CardStatus)
  if (!result.ok) {
    return Response.json(
      { message: result.message },
      { status: result.notFound ? 404 : 409 },
    )
  }

  return Response.json({ card: result.card })
}
