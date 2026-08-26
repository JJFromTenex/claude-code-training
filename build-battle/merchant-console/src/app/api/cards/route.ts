import { generateCardNumber, MASKED_CARD_NUMBER } from "@/lib/cardNumber"
import { CURRENCIES } from "@/lib/money"
import { merchantById } from "@/data/merchants"
import { store } from "@/data/store"
import { Card, Currency } from "@/data/types"
import { NextRequest, NextResponse } from "next/server"

interface IssueCardBody {
  nickname?: unknown
  merchantId?: unknown
  limit?: unknown
  currency?: unknown
}

/**
 * Issues a virtual card. Anything from the client — merchant, limit,
 * currency — is checked against an allowlist before it reaches the store.
 * The full card number is generated here and returned exactly once; the
 * record pushed to the store never contains it.
 */
export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => null)) as IssueCardBody | null
  if (!body) {
    return NextResponse.json({ message: "Invalid request body." }, { status: 400 })
  }

  const merchant = typeof body.merchantId === "string" ? merchantById(body.merchantId) : undefined
  if (!merchant) {
    return NextResponse.json({ message: "A valid merchant is required." }, { status: 400 })
  }

  const limit = body.limit
  if (typeof limit !== "number" || !Number.isInteger(limit) || limit <= 0) {
    return NextResponse.json(
      { message: "Spend limit must be greater than zero." },
      { status: 400 },
    )
  }
  if (limit > 5_000_000) {
    return NextResponse.json(
      { message: "Spend limit cannot exceed 5,000,000 minor units." },
      { status: 400 },
    )
  }

  const currency = body.currency
  if (typeof currency !== "string" || !CURRENCIES.includes(currency as Currency)) {
    return NextResponse.json(
      { message: "Currency must be one of USD, EUR, or GBP." },
      { status: 400 },
    )
  }

  const nickname = typeof body.nickname === "string" ? body.nickname.trim() : ""

  const fullNumber = generateCardNumber()
  const card: Card = {
    id: `card_${String(store.cards.length + 1).padStart(4, "0")}`,
    nickname,
    merchantId: merchant.id,
    limit,
    currency: currency as Currency,
    status: "active",
    maskedNumber: MASKED_CARD_NUMBER,
    spent: 0,
    createdAt: new Date().toISOString(),
  }
  store.cards.push(card)

  return NextResponse.json({ card, fullNumber }, { status: 201 })
}
