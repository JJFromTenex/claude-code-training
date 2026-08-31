import { merchantById, merchants } from "@/data/merchants"
import { store } from "@/data/store"
import { Card, Currency } from "@/data/types"
import { generateCard4242 } from "@/lib/card-generation"
import { NextRequest, NextResponse } from "next/server"

const VALID_CURRENCIES: readonly Currency[] = ["USD", "EUR", "GBP"]
const MAX_LIMIT = 5_000_000 // 5M minor units

/**
 * POST /api/cards — Issue a new virtual card
 * Returns the full number exactly once, on the success response.
 */
export async function POST(request: NextRequest) {
  const body = await request.json()

  const { nickname, merchantId, limit, currency } = body as {
    nickname?: unknown
    merchantId?: unknown
    limit?: unknown
    currency?: unknown
  }

  // Validate nickname
  if (!nickname || typeof nickname !== "string" || nickname.trim() === "") {
    return NextResponse.json({ error: "Nickname is required" }, { status: 400 })
  }

  // Validate merchantId is provided and exists
  if (!merchantId || typeof merchantId !== "string") {
    return NextResponse.json({ error: "Merchant is required" }, { status: 400 })
  }

  const merchant = merchants.find((m) => m.id === merchantId)
  if (!merchant) {
    return NextResponse.json({ error: "Merchant not found" }, { status: 400 })
  }

  // Validate limit: integer, positive, within bounds
  if (typeof limit !== "number" || !Number.isFinite(limit) || !Number.isInteger(limit)) {
    return NextResponse.json({ error: "Limit must be an integer" }, { status: 400 })
  }

  if (limit <= 0) {
    return NextResponse.json({ error: "Limit must be greater than zero" }, { status: 400 })
  }

  if (limit > MAX_LIMIT) {
    return NextResponse.json(
      { error: `Limit cannot exceed ${MAX_LIMIT} minor units` },
      { status: 400 },
    )
  }

  // Validate currency
  if (!VALID_CURRENCIES.includes(currency as Currency)) {
    return NextResponse.json(
      { error: `Currency must be one of: ${VALID_CURRENCIES.join(", ")}` },
      { status: 400 },
    )
  }

  // Generate card number
  const fullNumber = generateCard4242()
  const last4 = fullNumber.slice(-4)

  // Create card in store
  const card: Card = {
    id: `card_${Date.now()}_${Math.random().toString(36).slice(2)}`,
    nickname: nickname.trim(),
    merchantId,
    limit,
    currency: currency as Currency,
    last4,
    status: "active",
    createdAt: new Date().toISOString(),
    spend: 0,
  }

  store.cards.push(card)

  // Return card WITH full number (reveal once)
  return NextResponse.json({
    ...card,
    fullNumber,
  })
}

/**
 * GET /api/cards — List all issued cards (no full numbers, only last4)
 */
export async function GET() {
  // Return cards with resolved merchant names (no full numbers)
  const cardsWithMerchants = store.cards.map((card) => ({
    ...card,
    merchantName: merchantById(card.merchantId)?.name ?? card.merchantId,
  }))
  return NextResponse.json(cardsWithMerchants)
}
