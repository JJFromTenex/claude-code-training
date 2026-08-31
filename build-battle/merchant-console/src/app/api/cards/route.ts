import { issueCard, listCards } from "@/data/cards"
import { NextRequest, NextResponse } from "next/server"

/**
 * Lists cards (masked — see cardById route for the one exception) and
 * issues new ones. Validation happens in issueCard(); this handler's job
 * is to shape the request in and the response out.
 */

export function GET() {
  return NextResponse.json({ cards: listCards() })
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null)
  if (body === null || typeof body !== "object") {
    return NextResponse.json({ error: "Send a JSON body." }, { status: 400 })
  }

  const result = issueCard({
    nickname: (body as Record<string, unknown>).nickname,
    merchantId: (body as Record<string, unknown>).merchantId,
    limit: (body as Record<string, unknown>).limit,
    currency: (body as Record<string, unknown>).currency,
    category: (body as Record<string, unknown>).category,
  })

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 400 })
  }

  // The full number lives in this response body and nowhere else — not on
  // result.card, not on anything GET /api/cards or GET /api/cards/[id]
  // will ever return.
  return NextResponse.json(
    { card: result.card, number: result.number },
    { status: 201 },
  )
}
