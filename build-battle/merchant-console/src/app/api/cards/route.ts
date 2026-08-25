import {
  IssueCardInput,
  issueCardIdempotent,
  listCards,
  validateIssueCard,
} from "@/data/cards"
import { NextRequest, NextResponse } from "next/server"

export function GET() {
  return NextResponse.json({ cards: listCards() })
}

/**
 * A repeated Idempotency-Key returns the card already created for it rather
 * than issuing a second one — a double-click cannot mint two cards.
 */
export async function POST(request: NextRequest) {
  let body: Partial<IssueCardInput>
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ errors: ["Request body must be JSON."] }, { status: 400 })
  }

  const errors = validateIssueCard(body)
  if (errors.length > 0) {
    return NextResponse.json({ errors }, { status: 400 })
  }

  const idempotencyKey = request.headers.get("idempotency-key")
  const { card, number } = issueCardIdempotent(body as IssueCardInput, idempotencyKey)
  return NextResponse.json({ card, number }, { status: number ? 201 : 200 })
}
