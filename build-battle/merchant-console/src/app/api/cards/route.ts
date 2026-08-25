import { pad } from "@/data/generate"
import { merchantById } from "@/data/merchants"
import { store } from "@/data/store"
import { Card, CardCategory, Currency } from "@/data/types"
import {
  CARD_CATEGORIES,
  CARD_LIMIT_MAX_MINOR_UNITS,
  generateCardNumber,
} from "@/lib/cards"
import { NextRequest, NextResponse } from "next/server"

const CURRENCIES: readonly Currency[] = ["USD", "EUR", "GBP"]

/** GET returns every card, newest first. Records only ever carry last4/numberRef. */
export function GET() {
  const cards = [...store.cards].sort((a, b) =>
    b.createdAt.localeCompare(a.createdAt),
  )
  return NextResponse.json(cards)
}

/**
 * POST issues a card. Everything from the client is checked against an
 * allowlist before it reaches the store. The full number is generated here,
 * on the server, and returned exactly once in this response.
 */
export async function POST(request: NextRequest) {
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json(
      { message: "Request body must be valid JSON." },
      { status: 400 },
    )
  }

  if (typeof body !== "object" || body === null) {
    return NextResponse.json(
      { message: "Request body must be a JSON object." },
      { status: 400 },
    )
  }

  const { nickname, merchantId, limitMinorUnits, currency, category } =
    body as Record<string, unknown>

  const merchant = typeof merchantId === "string" ? merchantById(merchantId) : undefined
  if (!merchant) {
    return NextResponse.json({ message: "Unknown merchant." }, { status: 400 })
  }

  if (typeof nickname !== "string" || nickname.trim().length === 0) {
    return NextResponse.json(
      { message: "Nickname is required." },
      { status: 400 },
    )
  }
  if (nickname.trim().length > 60) {
    return NextResponse.json(
      { message: "Nickname must be 60 characters or fewer." },
      { status: 400 },
    )
  }

  if (typeof limitMinorUnits !== "number" || !Number.isInteger(limitMinorUnits)) {
    return NextResponse.json(
      { message: "Limit must be a whole number of minor units." },
      { status: 400 },
    )
  }
  if (limitMinorUnits <= 0) {
    return NextResponse.json(
      { message: "Limit must be greater than zero." },
      { status: 400 },
    )
  }
  if (limitMinorUnits > CARD_LIMIT_MAX_MINOR_UNITS) {
    return NextResponse.json(
      { message: `Limit cannot exceed ${CARD_LIMIT_MAX_MINOR_UNITS} minor units.` },
      { status: 400 },
    )
  }

  if (typeof currency !== "string" || !CURRENCIES.includes(currency as Currency)) {
    return NextResponse.json(
      { message: "Currency must be one of USD, EUR, GBP." },
      { status: 400 },
    )
  }
  if (currency !== merchant.currency) {
    return NextResponse.json(
      { message: "Currency must match the merchant's currency." },
      { status: 400 },
    )
  }

  if (
    typeof category !== "string" ||
    !CARD_CATEGORIES.includes(category as CardCategory)
  ) {
    return NextResponse.json(
      { message: "Category is not recognized." },
      { status: 400 },
    )
  }

  const number = generateCardNumber()
  const id = `crd_${pad(store.cards.length + 1)}`
  const createdAt = new Date().toISOString()

  const card: Card = {
    id,
    merchantId: merchant.id,
    nickname: nickname.trim(),
    last4: number.slice(-4),
    numberRef: `cardref_${id}`,
    limitMinorUnits,
    spentMinorUnits: 0,
    currency: currency as Currency,
    category: category as CardCategory,
    status: "active",
    createdAt,
    events: [{ type: "issued", at: createdAt }],
  }

  store.cards.push(card)

  return NextResponse.json({ card, fullNumber: number }, { status: 201 })
}
