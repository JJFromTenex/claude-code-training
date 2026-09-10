import { cardForIdempotencyKey, createCard, recordIdempotencyKey } from "@/data/cards"
import { merchantById } from "@/data/merchants"
import { CARD_CATEGORIES, CARD_CURRENCIES, MAX_SPEND_LIMIT_MINOR_UNITS } from "@/lib/cards"
import { NextRequest, NextResponse } from "next/server"

/**
 * Issues a virtual card. Every check below is a flat reject-early guard, in
 * the same allowlist spirit as parseFilters — nothing from the client
 * reaches the store unchecked.
 */
export async function POST(request: NextRequest) {
  let body
  try {
    body = await request.json()
  } catch {
    return NextResponse.json(
      { message: "Request body must be valid JSON." },
      { status: 400 },
    )
  }

  const { nickname, merchantId, spendLimit, currency, category } = body ?? {}

  const idempotencyKey = request.headers.get("Idempotency-Key")
  if (idempotencyKey) {
    const existing = cardForIdempotencyKey(idempotencyKey)
    if (existing) {
      return NextResponse.json({ card: existing }, { status: 200 })
    }
  }

  const merchant = merchantById(merchantId)
  if (!merchant) {
    return NextResponse.json(
      { message: "Unknown merchant." },
      { status: 400 },
    )
  }

  const trimmedNickname = typeof nickname === "string" ? nickname.trim() : ""
  if (!trimmedNickname) {
    return NextResponse.json(
      { message: "Nickname is required." },
      { status: 400 },
    )
  }

  if (
    !Number.isInteger(spendLimit) ||
    spendLimit <= 0 ||
    spendLimit > MAX_SPEND_LIMIT_MINOR_UNITS
  ) {
    return NextResponse.json(
      { message: "Spend limit must be a whole number of minor units, greater than zero and at most 5,000,000." },
      { status: 400 },
    )
  }

  if (!CARD_CURRENCIES.includes(currency)) {
    return NextResponse.json(
      { message: "Unsupported currency." },
      { status: 400 },
    )
  }

  if (currency !== merchant.currency) {
    return NextResponse.json(
      { message: "Currency must match the merchant's currency." },
      { status: 400 },
    )
  }

  if (!CARD_CATEGORIES.includes(category)) {
    return NextResponse.json(
      { message: "Unsupported category." },
      { status: 400 },
    )
  }

  const { card, number } = createCard({
    nickname: trimmedNickname,
    merchantId,
    spendLimit,
    currency,
    category,
  })

  if (idempotencyKey) {
    recordIdempotencyKey(idempotencyKey, card.id)
  }

  return NextResponse.json({ card, number }, { status: 201 })
}
