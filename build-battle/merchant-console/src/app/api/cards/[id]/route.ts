import { cardById } from "@/data/cards"
import { CardStatus } from "@/data/types"
import { canTransition } from "@/lib/cards"
import { NextRequest } from "next/server"

const CARD_STATUSES: readonly CardStatus[] = ["active", "frozen", "cancelled"]

function jsonError(message: string, status: number): Response {
  return Response.json({ error: message }, { status })
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const card = cardById(id)
  if (!card) return jsonError("Card not found", 404)

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return jsonError("Body must be JSON", 400)
  }
  if (!body || typeof body !== "object") {
    return jsonError("Body must be JSON", 400)
  }

  const target = (body as Record<string, unknown>).status
  if (
    typeof target !== "string" ||
    !(CARD_STATUSES as readonly string[]).includes(target)
  ) {
    return jsonError("status must be one of active, frozen, cancelled", 400)
  }

  if (!canTransition(card.status, target as CardStatus)) {
    return jsonError(
      `Cannot transition from ${card.status} to ${target}`,
      409,
    )
  }

  card.status = target as CardStatus
  return Response.json({ card })
}
