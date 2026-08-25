import { merchantById } from "@/data/merchants"
import { store } from "@/data/store"
import { Card, Currency, MerchantCategory } from "@/data/types"
import {
  generateCardNumber,
  last4FromNumber,
  MERCHANT_CATEGORIES,
} from "@/lib/cards"
import { NextRequest, NextResponse } from "next/server"

const CURRENCIES: readonly Currency[] = ["USD", "EUR", "GBP"]
const MAX_LIMIT = 5_000_000

export function GET() {
  return NextResponse.json({ cards: store.cards })
}

/**
 * Issues a card. Nothing here is trusted from the client: merchant, limit,
 * currency, and category are all checked before a number is generated or a
 * record is stored. The full number is generated here and returned exactly
 * once in this response — it is never written to the store.
 *
 * An `Idempotency-Key` header makes a retried request (a client timeout,
 * a double-click that got past the button's own disabled state, a proxy
 * replay) return the original response — including the original number —
 * rather than issuing a second card. Without a database, "already
 * processed" just means "already in this map."
 */
export async function POST(request: NextRequest) {
  const idempotencyKey = request.headers.get("idempotency-key")
  if (idempotencyKey) {
    const already = store.cardIssuance.get(idempotencyKey)
    if (already) {
      return NextResponse.json(already, { status: 201 })
    }
  }

  const body = await request.json().catch(() => null)
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 })
  }

  const nickname = typeof body.nickname === "string" ? body.nickname.trim() : ""
  const merchantId = typeof body.merchantId === "string" ? body.merchantId : ""
  const limit = Number(body.limit)
  const currency = body.currency as Currency
  const category = body.category as MerchantCategory

  if (!nickname) {
    return NextResponse.json({ error: "Nickname is required." }, { status: 400 })
  }
  const merchant = merchantId ? merchantById(merchantId) : undefined
  if (!merchant) {
    return NextResponse.json({ error: "A valid merchant is required." }, { status: 400 })
  }
  if (!Number.isInteger(limit) || limit <= 0) {
    return NextResponse.json(
      { error: "Spend limit must be a positive whole number of minor units." },
      { status: 400 },
    )
  }
  if (limit > MAX_LIMIT) {
    return NextResponse.json(
      { error: `Spend limit cannot exceed ${MAX_LIMIT.toLocaleString()} minor units.` },
      { status: 400 },
    )
  }
  if (!CURRENCIES.includes(currency)) {
    return NextResponse.json(
      { error: "Currency must be one of USD, EUR, or GBP." },
      { status: 400 },
    )
  }
  if (currency !== merchant.currency) {
    return NextResponse.json(
      { error: `Currency must match the merchant's own currency (${merchant.currency}).` },
      { status: 400 },
    )
  }
  if (!MERCHANT_CATEGORIES.includes(category)) {
    return NextResponse.json({ error: "A valid merchant category is required." }, { status: 400 })
  }

  const number = generateCardNumber()
  const createdAt = new Date().toISOString()
  const card: Card = {
    id: `card_${String(store.cards.length + 1).padStart(6, "0")}`,
    nickname,
    merchantId,
    category,
    limit,
    spent: 0,
    currency,
    status: "active",
    last4: last4FromNumber(number),
    createdAt,
    history: [{ status: "active", at: createdAt }],
  }

  store.cards.push(card)

  const response = { card, number }
  if (idempotencyKey) store.cardIssuance.set(idempotencyKey, response)

  return NextResponse.json(response, { status: 201 })
}
