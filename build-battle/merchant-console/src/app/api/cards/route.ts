import { cardByIssueKey, insertCard, listCards } from "@/data/cards"
import {
  generateCardNumber,
  newNumberRef,
  validateIssueRequest,
} from "@/lib/cards"
import { NextRequest, NextResponse } from "next/server"

export function GET() {
  return NextResponse.json({ rows: listCards() })
}

const IDEMPOTENCY_HEADER = "idempotency-key"
const IDEMPOTENCY_KEY_PATTERN = /^[A-Za-z0-9_-]{8,128}$/

/**
 * Issues a card. This is the one response that carries the full number: it is
 * generated here, handed back once, and only the last four and a reference
 * reach the store.
 *
 * A client may send an `Idempotency-Key` header. A retry with the same key
 * returns the card it already issued, without the number, instead of minting
 * a second one.
 */
export async function POST(request: NextRequest) {
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json(
      { message: "Request body must be JSON." },
      { status: 400 },
    )
  }

  const idempotencyKey = request.headers.get(IDEMPOTENCY_HEADER) ?? undefined
  if (idempotencyKey !== undefined && !IDEMPOTENCY_KEY_PATTERN.test(idempotencyKey)) {
    return NextResponse.json(
      { message: "Idempotency-Key must be 8 to 128 letters, digits, dashes, or underscores." },
      { status: 400 },
    )
  }
  const replayed = idempotencyKey ? cardByIssueKey(idempotencyKey) : null
  if (replayed) {
    return NextResponse.json({ card: replayed, replayed: true }, { status: 200 })
  }

  const validation = validateIssueRequest(body)
  if (!validation.ok) {
    return NextResponse.json(
      { message: validation.message, field: validation.field },
      { status: 400 },
    )
  }

  const number = generateCardNumber()
  const card = insertCard(
    {
      ...validation.value,
      last4: number.slice(-4),
      numberRef: newNumberRef(),
    },
    { idempotencyKey },
  )

  return NextResponse.json({ card, number }, { status: 201 })
}
