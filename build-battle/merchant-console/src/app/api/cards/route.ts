import { merchantById } from "@/data/merchants"
import { store } from "@/data/store"
import { Card, CardCategory, Currency } from "@/data/types"
import { CARD_CATEGORIES, generateCardNumber } from "@/lib/cards"
import { NextRequest } from "next/server"

const CURRENCIES: readonly Currency[] = ["USD", "EUR", "GBP"]
const MAX_SPEND_LIMIT_MINOR = 5_000_000

function badRequest(message: string): Response {
  return Response.json({ error: message }, { status: 400 })
}

interface CardPayload {
  merchantId: string
  nickname: string
  spendLimit: number
  currency: Currency
  category: CardCategory
}

function parsePayload(input: unknown): CardPayload | { error: string } {
  if (!input || typeof input !== "object") return { error: "Invalid body" }
  const body = input as Record<string, unknown>

  const merchantId = body.merchantId
  if (typeof merchantId !== "string" || merchantId.length === 0) {
    return { error: "merchantId is required" }
  }
  if (!merchantById(merchantId)) {
    return { error: "Unknown merchant" }
  }

  const nicknameRaw = body.nickname
  if (typeof nicknameRaw !== "string" || nicknameRaw.trim().length === 0) {
    return { error: "nickname is required" }
  }
  const nickname = nicknameRaw.trim()

  const spendLimit = body.spendLimit
  if (
    typeof spendLimit !== "number" ||
    !Number.isInteger(spendLimit) ||
    spendLimit <= 0
  ) {
    return { error: "spendLimit must be a positive integer in minor units" }
  }
  if (spendLimit > MAX_SPEND_LIMIT_MINOR) {
    return { error: "spendLimit exceeds the maximum of 5,000,000 minor units" }
  }

  const currency = body.currency
  if (
    typeof currency !== "string" ||
    !(CURRENCIES as readonly string[]).includes(currency)
  ) {
    return { error: "currency must be one of USD, EUR, GBP" }
  }

  const category = body.category
  if (
    typeof category !== "string" ||
    !(CARD_CATEGORIES as readonly string[]).includes(category)
  ) {
    return { error: "category must be one of retail, marketplace, subscription, services" }
  }

  return {
    merchantId,
    nickname,
    spendLimit,
    currency: currency as Currency,
    category: category as CardCategory,
  }
}

function nextCardId(): string {
  const n = store.cards.length + 1
  return `crd_${n.toString().padStart(4, "0")}`
}

export async function POST(request: NextRequest) {
  let json: unknown
  try {
    json = await request.json()
  } catch {
    return badRequest("Body must be JSON")
  }

  const parsed = parsePayload(json)
  if ("error" in parsed) return badRequest(parsed.error)

  const cardNumber = generateCardNumber()
  const card: Card = {
    id: nextCardId(),
    merchantId: parsed.merchantId,
    nickname: parsed.nickname,
    spendLimit: parsed.spendLimit,
    spend: 0,
    currency: parsed.currency,
    category: parsed.category,
    status: "active",
    last4: cardNumber.slice(-4),
    createdAt: new Date().toISOString(),
  }
  store.cards.push(card)

  // The full number appears in this response and nowhere else.
  return Response.json({ card, cardNumber }, { status: 201 })
}
