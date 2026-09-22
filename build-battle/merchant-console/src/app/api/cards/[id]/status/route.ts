import { moveCardStatus } from "@/data/card-queries"
import { jsonError } from "@/lib/api"
import { isCardAction, statusForAction } from "@/lib/card-status"
import { NextRequest, NextResponse } from "next/server"

/**
 * Freeze, unfreeze and cancel all land here. The action name is allowlisted
 * and the transition table decides, so a forged action cannot revive a
 * cancelled card.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return jsonError(400, "Expected a JSON body.")
  }

  const action = (body as { action?: unknown } | null)?.action
  if (!isCardAction(action)) {
    return jsonError(400, "Action must be freeze, unfreeze, or cancel.", {
      action: "Unknown action.",
    })
  }

  const result = moveCardStatus(id, statusForAction(action))
  if ("error" in result) {
    return result.error === "not_found"
      ? jsonError(404, "No card with that id.")
      : jsonError(409, "That card cannot move to that status from its current one.")
  }

  return NextResponse.json(result.card)
}
