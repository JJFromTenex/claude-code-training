import { issueCard, validateIssueCard } from "@/data/cards"
import { NextRequest, NextResponse } from "next/server"

/**
 * Issues a virtual card. This response is the only place the full number
 * ever appears; the record keeps the last four and a reference.
 *
 * An `Idempotency-Key` header makes a retry safe: the same key returns the
 * card that was already issued, with `replayed: true` and no number.
 */
export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null)
  const result = validateIssueCard(body)
  if (result.errors) {
    return NextResponse.json({ errors: result.errors }, { status: 400 })
  }

  const key = request.headers.get("idempotency-key") ?? undefined
  const { card, cardNumber, replayed } = issueCard(result.input, key)
  return NextResponse.json(
    replayed ? { card, replayed } : { card, cardNumber, replayed },
    { status: replayed ? 200 : 201 },
  )
}
