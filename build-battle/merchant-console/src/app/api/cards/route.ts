import { merchantById } from "@/data/merchants"
import { allCards } from "@/data/queries"
import { store } from "@/data/store"
import { Card } from "@/data/types"
import {
  checkIssue,
  generateCardNumber,
  generateCardReference,
} from "@/lib/cards"
import { NextRequest, NextResponse } from "next/server"

/**
 * Issue a virtual card.
 *
 * The number is generated here, used for the last four, and returned exactly
 * once in this response. It is never written to the store and no later read
 * can recover it — the record keeps the last four and an opaque reference.
 */

const error = (message: string, status: number) =>
  NextResponse.json({ message }, { status })

export function GET() {
  return NextResponse.json({ cards: allCards() })
}

export async function POST(request: NextRequest) {
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return error("Expected a JSON body.", 400)
  }

  const { nickname, merchantId, spendLimit, currency } = (body ?? {}) as {
    nickname?: unknown
    merchantId?: unknown
    spendLimit?: unknown
    currency?: unknown
  }

  const checked = checkIssue({
    nickname,
    merchantId,
    spendLimit,
    currency,
    merchantExists: (id) => merchantById(id) !== undefined,
  })
  if (!checked.ok) return error(checked.message, 400)

  const number = generateCardNumber()

  const card: Card = {
    id: `card_${String(store.cards.length + 1).padStart(4, "0")}`,
    nickname: checked.nickname,
    merchantId: checked.merchantId,
    spendLimit: checked.spendLimit,
    spent: 0,
    currency: checked.currency,
    status: "active",
    last4: number.slice(-4),
    reference: generateCardReference(),
    createdAt: new Date().toISOString(),
  }
  store.cards.push(card)

  // `number` is in this response and nowhere else, ever.
  return NextResponse.json({ card, number }, { status: 201 })
}
