import { cardById } from "@/data/queries"
import { canTransition, isCardStatus } from "@/lib/cards"
import { NextRequest } from "next/server"

/** A single card. Last four only — the full number is not re-readable. */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const card = cardById(id)
  if (!card) {
    return Response.json({ message: "No such card." }, { status: 404 })
  }
  return Response.json({ card })
}

/**
 * Move a card through its status machine: active ⇄ frozen, either to
 * cancelled, and cancelled is terminal. The guard lives here, not in the UI.
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const card = cardById(id)
  if (!card) {
    return Response.json({ message: "No such card." }, { status: 404 })
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return Response.json({ message: "Expected a JSON body." }, { status: 400 })
  }

  const status = (body as { status?: unknown })?.status
  if (typeof status !== "string" || !isCardStatus(status)) {
    return Response.json(
      { message: "Status must be active, frozen, or cancelled." },
      { status: 400 },
    )
  }

  if (status === card.status) {
    return Response.json({ card })
  }

  if (!canTransition(card.status, status)) {
    return Response.json(
      {
        message:
          card.status === "cancelled"
            ? "A cancelled card cannot be reopened."
            : `A ${card.status} card cannot become ${status}.`,
      },
      { status: 409 },
    )
  }

  card.status = status
  return Response.json({ card })
}
