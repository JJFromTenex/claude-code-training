import { merchantById } from "@/data/merchants"
import { store } from "@/data/store"
import { Card, Currency, MerchantCategory } from "@/data/types"
import { generateCardNumber, last4FromNumber } from "@/lib/cards"
import { NextRequest, NextResponse } from "next/server"

const VALID_CURRENCIES: Currency[] = ["USD", "EUR", "GBP"]

const VALID_CATEGORIES: MerchantCategory[] = [
  "advertising",
  "software",
  "travel",
  "contractors",
  "office_supplies",
  "other",
]

const MAX_SPEND_LIMIT = 5_000_000

let cardSeq = 0
function nextCardId() {
  return `card_${String(++cardSeq).padStart(6, "0")}`
}

export function GET() {
  const cards = store.cards.map(({ ...card }) => card)
  return NextResponse.json(cards)
}

export async function POST(request: NextRequest) {
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ message: "Invalid JSON" }, { status: 400 })
  }

  if (!body || typeof body !== "object") {
    return NextResponse.json({ message: "Request body required" }, { status: 400 })
  }

  const { nickname, merchantId, spendLimit, currency, category } = body as Record<string, unknown>

  if (!nickname || typeof nickname !== "string" || nickname.trim() === "") {
    return NextResponse.json({ message: "nickname is required" }, { status: 400 })
  }

  if (!merchantId || typeof merchantId !== "string") {
    return NextResponse.json({ message: "merchantId is required" }, { status: 400 })
  }
  if (!merchantById(merchantId)) {
    return NextResponse.json({ message: "Unknown merchant" }, { status: 400 })
  }

  if (typeof spendLimit !== "number" || !Number.isInteger(spendLimit)) {
    return NextResponse.json({ message: "spendLimit must be an integer (minor units)" }, { status: 400 })
  }
  if (spendLimit <= 0) {
    return NextResponse.json({ message: "spendLimit must be greater than zero" }, { status: 400 })
  }
  if (spendLimit > MAX_SPEND_LIMIT) {
    return NextResponse.json({ message: `spendLimit cannot exceed ${MAX_SPEND_LIMIT}` }, { status: 400 })
  }

  if (!currency || !VALID_CURRENCIES.includes(currency as Currency)) {
    return NextResponse.json({ message: "currency must be USD, EUR, or GBP" }, { status: 400 })
  }

  if (category !== undefined && !VALID_CATEGORIES.includes(category as MerchantCategory)) {
    return NextResponse.json({ message: "Invalid category" }, { status: 400 })
  }

  const pan = generateCardNumber()
  const card: Card = {
    id: nextCardId(),
    merchantId: merchantId as string,
    nickname: nickname.trim(),
    last4: last4FromNumber(pan),
    spendLimit: spendLimit as number,
    currency: currency as Currency,
    status: "active",
    ...(category ? { category: category as MerchantCategory } : {}),
    createdAt: new Date().toISOString(),
  }

  store.cards.push(card)

  return NextResponse.json({ ...card, pan }, { status: 201 })
}
