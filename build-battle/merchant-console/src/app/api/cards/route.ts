import { merchantById } from "@/data/merchants"
import { listCards, nextCardId } from "@/data/queries"
import { store } from "@/data/store"
import { Card } from "@/data/types"
import {
  generateCardNumber,
  lastFour,
  parseCardDraft,
} from "@/lib/cards"
import { NextRequest } from "next/server"

/** Issued cards. The full number is never in this payload — last four only. */
export function GET() {
  return Response.json({ cards: listCards() })
}

/**
 * Issue a virtual card.
 *
 * Everything in the body arrives from the client and is validated here before
 * anything is written. The number is generated server-side on the 4242 test BIN
 * and returned exactly once, in this response: only the last four is stored.
 */
export async function POST(request: NextRequest) {
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return Response.json(
      { message: "Expected a JSON body." },
      { status: 400 },
    )
  }

  const parsed = parseCardDraft(body, (id) => Boolean(merchantById(id)))
  if (!parsed.ok) {
    return Response.json({ message: parsed.message }, { status: 400 })
  }

  const { nickname, merchantId, spendLimit, currency } = parsed.value
  const number = generateCardNumber()

  const card: Card = {
    id: nextCardId(),
    nickname,
    merchantId,
    spendLimit,
    spent: 0,
    currency,
    status: "active",
    last4: lastFour(number),
    createdAt: new Date().toISOString(),
  }

  store.cards.push(card)

  // The one and only time the full number leaves the server.
  return Response.json({ card, number }, { status: 201 })
}
