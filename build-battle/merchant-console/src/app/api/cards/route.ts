import {
  CARD_CATEGORIES,
  CARD_CURRENCIES,
  MAX_SPEND_LIMIT,
  addCard,
  allCards,
} from "@/data/cards"
import { merchantById } from "@/data/merchants"
import { CardCategory, Currency } from "@/data/types"
import { NextRequest, NextResponse } from "next/server"

/**
 * Every 4xx from the card routes is `{ error }` with a message safe to show a
 * user. The client's own checks are a convenience; this is the enforcement.
 */
function reject(error: string, status = 400) {
  return NextResponse.json({ error }, { status })
}

export function GET() {
  // No full number here, and no field on Card that could carry one.
  return NextResponse.json(allCards())
}

export async function POST(request: NextRequest) {
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return reject("Request body must be JSON.")
  }

  const input = body as Record<string, unknown>

  const nickname = typeof input.nickname === "string" ? input.nickname.trim() : ""
  if (!nickname) return reject("Give the card a nickname.")

  const merchantId =
    typeof input.merchantId === "string" ? input.merchantId.trim() : ""
  if (!merchantId) return reject("Choose a merchant.")
  if (!merchantById(merchantId)) return reject("That merchant does not exist.")

  const currency = input.currency
  if (!CARD_CURRENCIES.includes(currency as Currency)) {
    return reject("Currency must be USD, EUR, or GBP.")
  }

  const spendLimit = input.spendLimit
  if (typeof spendLimit !== "number" || !Number.isInteger(spendLimit)) {
    return reject("Spend limit must be a whole number of minor units.")
  }
  if (spendLimit <= 0) return reject("Spend limit must be greater than zero.")
  if (spendLimit > MAX_SPEND_LIMIT) {
    return reject(
      `Spend limit cannot exceed ${MAX_SPEND_LIMIT.toLocaleString("en-US")} minor units.`,
    )
  }

  const category = input.category ?? "other"
  if (!CARD_CATEGORIES.includes(category as CardCategory)) {
    return reject("Choose a valid spend category.")
  }

  const { card, fullNumber } = addCard({
    nickname,
    merchantId,
    spendLimit,
    currency: currency as Currency,
    category: category as CardCategory,
  })

  // The only response in the console that carries a full number.
  return NextResponse.json({ card, fullNumber }, { status: 201 })
}
