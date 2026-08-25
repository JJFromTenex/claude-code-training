import { listCards, nextCardId } from "@/data/queries"
import { store } from "@/data/store"
import { Card } from "@/data/types"
import {
  generateCardNumber,
  generateCardReference,
  validateIssueRequest,
} from "@/lib/cards"
import { NextRequest, NextResponse } from "next/server"

/**
 * Virtual cards.
 *
 * GET returns the card records, which never contain a full number.
 * POST issues one: the number is generated here, on the server, and appears in
 * this response and nowhere else for the rest of its life.
 */

export function GET() {
  return NextResponse.json({ cards: listCards() })
}

export async function POST(request: NextRequest) {
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ message: "Expected a JSON body." }, { status: 400 })
  }

  const parsed = validateIssueRequest(body)
  if (!parsed.ok) {
    return NextResponse.json({ message: parsed.message }, { status: 400 })
  }

  const { nickname, merchantId, spendLimit, currency, category } = parsed.value

  // Generated server-side, reduced to its last four immediately. The full
  // number is held in a local and returned once; it is never written anywhere.
  const cardNumber = generateCardNumber()
  const createdAt = new Date().toISOString()

  const card: Card = {
    id: nextCardId(),
    nickname,
    merchantId,
    last4: cardNumber.slice(-4),
    reference: generateCardReference(),
    spendLimit,
    spent: 0,
    currency,
    status: "active",
    category,
    createdAt,
    events: [{ at: createdAt, from: null, to: "active" }],
  }

  store.cards.push(card)

  // `number` is the one-time reveal. No later response carries it.
  return NextResponse.json({ card, number: cardNumber }, { status: 201 })
}
