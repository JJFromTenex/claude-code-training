import { generateCardNumber, last4Of } from "@/lib/cards"
import { merchantById } from "@/data/merchants"
import { store } from "@/data/store"
import { Card, Currency, MerchantCategory } from "@/data/types"
import { NextRequest, NextResponse } from "next/server"

const CURRENCIES: readonly Currency[] = ["USD", "EUR", "GBP"]
const CATEGORIES: readonly MerchantCategory[] = [
  "advertising",
  "software",
  "shipping",
  "office_supplies",
  "travel",
]
const MAX_SPEND_LIMIT = 5_000_000

/** GET /api/cards — every issued card, newest first. Never a full number. */
export function GET() {
  const cards = [...store.cards].sort((a, b) =>
    b.createdAt.localeCompare(a.createdAt),
  )
  return NextResponse.json({ cards })
}

/**
 * POST /api/cards — issue a card.
 * Everything from the client is checked against an allowlist before it
 * reaches the store. The full generated number is returned exactly once,
 * in this response, and is never stored or returned again.
 */
export async function POST(request: NextRequest) {
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ message: "Request body must be JSON." }, { status: 400 })
  }

  if (typeof body !== "object" || body === null) {
    return NextResponse.json({ message: "Request body must be JSON." }, { status: 400 })
  }

  const { nickname, merchantId, spendLimit, currency, categoryLock } =
    body as Record<string, unknown>

  if (typeof nickname !== "string" || nickname.trim().length === 0) {
    return NextResponse.json({ message: "Nickname is required." }, { status: 400 })
  }

  if (typeof merchantId !== "string" || !merchantById(merchantId)) {
    return NextResponse.json({ message: "A valid merchant is required." }, { status: 400 })
  }

  if (
    typeof spendLimit !== "number" ||
    !Number.isInteger(spendLimit) ||
    spendLimit <= 0
  ) {
    return NextResponse.json(
      { message: "Spend limit must be a positive whole number of minor units." },
      { status: 400 },
    )
  }

  if (spendLimit > MAX_SPEND_LIMIT) {
    return NextResponse.json(
      { message: `Spend limit cannot exceed ${MAX_SPEND_LIMIT} minor units.` },
      { status: 400 },
    )
  }

  if (typeof currency !== "string" || !CURRENCIES.includes(currency as Currency)) {
    return NextResponse.json(
      { message: "Currency must be one of USD, EUR, GBP." },
      { status: 400 },
    )
  }

  if (
    categoryLock !== undefined &&
    categoryLock !== null &&
    (typeof categoryLock !== "string" ||
      !CATEGORIES.includes(categoryLock as MerchantCategory))
  ) {
    return NextResponse.json(
      { message: "Category lock must be a known merchant category." },
      { status: 400 },
    )
  }

  const fullNumber = generateCardNumber()
  const last4 = last4Of(fullNumber)

  const card: Card = {
    id: `card_${Math.random().toString(36).slice(2, 10)}`,
    nickname: nickname.trim(),
    merchantId,
    last4,
    spendLimit,
    currency: currency as Currency,
    status: "active",
    spent: 0,
    categoryLock: (categoryLock as MerchantCategory | undefined) ?? null,
    createdAt: new Date().toISOString(),
  }

  store.cards.push(card)

  return NextResponse.json({ card, fullNumber }, { status: 201 })
}
