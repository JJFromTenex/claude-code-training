import { store } from "@/data/store"
import { Card, Currency } from "@/data/types"
import { generateCardNumber, getLastFour } from "@/lib/luhn"
import { merchantById } from "@/data/merchants"
import { NextRequest, NextResponse } from "next/server"

const VALID_CURRENCIES: Currency[] = ["USD", "EUR", "GBP"]
const MAX_LIMIT = 500000000 // 5,000,000 in minor units

export function GET() {
  const cards = store.cards.map((card) => ({
    ...card,
  }))
  return NextResponse.json(cards)
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { merchantId, nickname, limit, currency } = body

    // Validate merchant exists
    if (!merchantId || typeof merchantId !== "string") {
      return NextResponse.json(
        { error: "Merchant ID is required" },
        { status: 400 },
      )
    }

    const merchant = merchantById(merchantId)
    if (!merchant) {
      return NextResponse.json(
        { error: "Merchant not found" },
        { status: 400 },
      )
    }

    // Validate nickname
    if (!nickname || typeof nickname !== "string" || !nickname.trim()) {
      return NextResponse.json(
        { error: "Nickname is required" },
        { status: 400 },
      )
    }

    // Validate limit
    if (typeof limit !== "number") {
      return NextResponse.json(
        { error: "Limit must be a number" },
        { status: 400 },
      )
    }

    if (limit <= 0) {
      return NextResponse.json(
        { error: "Limit must be greater than 0" },
        { status: 400 },
      )
    }

    if (limit > MAX_LIMIT) {
      return NextResponse.json(
        { error: `Limit cannot exceed ${MAX_LIMIT / 100}` },
        { status: 400 },
      )
    }

    // Validate currency
    if (!currency || !VALID_CURRENCIES.includes(currency)) {
      return NextResponse.json(
        { error: `Currency must be one of: ${VALID_CURRENCIES.join(", ")}` },
        { status: 400 },
      )
    }

    // Generate card
    const fullCardNumber = generateCardNumber()
    const last4 = getLastFour(fullCardNumber)

    const card: Card = {
      id: `card_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      merchantId,
      nickname: nickname.trim(),
      last4,
      limit,
      currency,
      status: "active",
      createdAt: new Date().toISOString(),
    }

    // Store card
    store.cards.push(card)

    // Return response with full number (shown once only)
    return NextResponse.json(
      {
        ...card,
        fullNumber: fullCardNumber,
      },
      { status: 201 },
    )
  } catch (error) {
    return NextResponse.json(
      { error: "Invalid request" },
      { status: 400 },
    )
  }
}
