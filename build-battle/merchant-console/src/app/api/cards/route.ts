import { validateIssueCard } from "@/data/cardRules"
import { issueCard, listCards } from "@/data/cards"
import { apiError as error } from "@/lib/apiError"
import { NextRequest, NextResponse } from "next/server"

const IDEMPOTENCY_KEY = /^[A-Za-z0-9-]{1,100}$/

export function GET() {
  return NextResponse.json({ cards: listCards() })
}

/**
 * Issues a card. The response body is the only place the full number ever
 * appears; it is not stored, and no other route can return it.
 */
export async function POST(request: NextRequest) {
  const key = request.headers.get("idempotency-key")
  if (!key || !IDEMPOTENCY_KEY.test(key)) {
    return error(400, "Missing or malformed Idempotency-Key header.")
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return error(400, "Request body must be JSON.")
  }

  const validation = validateIssueCard(body)
  if (!validation.ok) {
    return error(400, "Some fields need attention.", {
      fields: validation.errors,
    })
  }

  const result = issueCard(validation.value, key)
  if (result.status === "duplicate") {
    return error(409, "This request already issued a card.", {
      cardId: result.cardId,
    })
  }

  return NextResponse.json(
    { card: result.card, number: result.number },
    { status: 201, headers: { "cache-control": "no-store" } },
  )
}
