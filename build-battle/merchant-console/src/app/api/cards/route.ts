import {
  issueCard,
  issuedForKey,
  listCards,
  rememberIdempotencyKey,
  validateIssueInput,
} from "@/data/cards"
import { NextRequest, NextResponse } from "next/server"

/**
 * Cards.
 *
 * `POST` is the one place in this application where a full card number is
 * returned, and it is returned once. `GET` returns records, which carry the
 * last four and never the number (`.claude/rules/api-routes.md`).
 */

export function GET() {
  const cards = listCards()
  return NextResponse.json({ cards, total: cards.length })
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

  // A double-clicked button or a retried request must not issue twice. The
  // replay returns the record only: the number was already revealed once.
  const idempotencyKey = request.headers.get("idempotency-key")?.trim()
  if (idempotencyKey) {
    const existing = issuedForKey(idempotencyKey)
    if (existing) {
      return NextResponse.json(
        { card: existing, replayed: true },
        { status: 200 },
      )
    }
  }

  const validated = validateIssueInput(body)
  if (!validated.ok) {
    return NextResponse.json(
      {
        message: "That card could not be issued.",
        errors: validated.errors,
      },
      { status: 422 },
    )
  }

  const { card, number } = issueCard(validated.input)
  if (idempotencyKey) rememberIdempotencyKey(idempotencyKey, card.id)

  return NextResponse.json({ card, number, replayed: false }, { status: 201 })
}
