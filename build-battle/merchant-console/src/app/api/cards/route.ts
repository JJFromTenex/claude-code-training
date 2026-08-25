import { allCards, createCard } from "@/data/cards"
import { merchants } from "@/data/merchants"
import { CardCategory, Currency } from "@/data/types"
import {
  CARD_CATEGORIES,
  CARD_CURRENCIES,
  MAX_SPEND_LIMIT,
} from "@/lib/cards"
import { NextRequest, NextResponse } from "next/server"

/**
 * Issue and list virtual cards.
 *
 * Everything in the body arrives from the client and is checked against an
 * allowlist here. The form does the same checks for the person typing; these
 * are the ones that count.
 */

function badRequest(message: string) {
  return NextResponse.json({ message }, { status: 400 })
}

export function GET() {
  return NextResponse.json({ cards: allCards() })
}

export async function POST(request: NextRequest) {
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return badRequest("Send a JSON body.")
  }

  const input = body as Record<string, unknown>

  const nickname = typeof input.nickname === "string" ? input.nickname.trim() : ""
  if (nickname === "") return badRequest("Give the card a nickname.")
  if (nickname.length > 60) {
    return badRequest("Nicknames are 60 characters or fewer.")
  }

  const merchantId = input.merchantId
  if (typeof merchantId !== "string" || !merchants.some((m) => m.id === merchantId)) {
    return badRequest("Choose a merchant for this card.")
  }

  const spendLimit = input.spendLimit
  if (typeof spendLimit !== "number" || !Number.isInteger(spendLimit)) {
    return badRequest("The spend limit must be a whole number of minor units.")
  }
  if (spendLimit <= 0) {
    return badRequest("The spend limit must be greater than zero.")
  }
  if (spendLimit > MAX_SPEND_LIMIT) {
    return badRequest("The spend limit cannot be above 5,000,000 minor units.")
  }

  const currency = input.currency
  if (!CARD_CURRENCIES.includes(currency as Currency)) {
    return badRequest("Currency must be one of USD, EUR, or GBP.")
  }

  const category = input.category ?? "other"
  if (!CARD_CATEGORIES.includes(category as CardCategory)) {
    return badRequest("Choose a category this card is locked to.")
  }

  const { card, number } = createCard({
    nickname,
    merchantId,
    spendLimit,
    currency: currency as Currency,
    category: category as CardCategory,
  })

  // The only response that ever carries the full number.
  return NextResponse.json({ card, number }, { status: 201 })
}
