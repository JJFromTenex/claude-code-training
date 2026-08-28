import {
  cardByRequestId,
  issueCard,
  listCards,
  parseIssueRequest,
} from "@/data/cards"
import { maskCard } from "@/lib/cards"
import { NextRequest, NextResponse } from "next/server"

/**
 * Virtual cards.
 *
 * GET returns masked records only. POST is the one response in the system
 * that carries a full number, and it carries it exactly once: a replayed
 * request returns the card it already created without revealing it again.
 */
export function GET() {
  return NextResponse.json({ cards: listCards().map(maskCard) })
}

export async function POST(request: NextRequest) {
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json(
      { message: "Send a JSON body." },
      { status: 400 },
    )
  }

  const parsed = parseIssueRequest(body)
  if (!parsed.ok) {
    return NextResponse.json(
      { message: "That card could not be issued.", errors: parsed.errors },
      { status: 422 },
    )
  }

  // A double click or a retry after a timeout carries the same request id, and
  // must not mint a second card. The header wins so a client can retry without
  // rebuilding the body.
  const requestId =
    request.headers.get("idempotency-key") ?? parsed.input.requestId
  if (requestId) {
    const existing = cardByRequestId(requestId)
    if (existing) {
      return NextResponse.json(
        { card: maskCard(existing), replayed: true },
        { status: 200 },
      )
    }
  }

  const { card, number } = issueCard({ ...parsed.input, requestId })
  return NextResponse.json(
    { card: maskCard(card), number, replayed: false },
    { status: 201 },
  )
}
