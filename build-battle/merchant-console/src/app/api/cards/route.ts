import { createCard } from "@/data/cards"
import { merchantById } from "@/data/merchants"
import {
  isValidCardCategory,
  isValidCardCurrency,
  isValidCardLimit,
} from "@/lib/cards"
import { parseAmountToMinorUnits } from "@/lib/money"
import { NextRequest, NextResponse } from "next/server"

/**
 * Issues a card. Every value from the client is checked against an
 * allowlist before it reaches the store — nickname, merchant, limit,
 * currency, category. The full number is generated server-side and
 * returned exactly once, in this response.
 */
export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null)

  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 })
  }

  const nickname = typeof body.nickname === "string" ? body.nickname.trim() : ""
  if (!nickname) {
    return NextResponse.json({ error: "Nickname is required." }, { status: 400 })
  }

  const merchant =
    typeof body.merchantId === "string" ? merchantById(body.merchantId) : undefined
  if (!merchant) {
    return NextResponse.json({ error: "Choose a merchant." }, { status: 400 })
  }

  const limit =
    typeof body.limit === "string" ? parseAmountToMinorUnits(body.limit) : null
  if (limit === null || !isValidCardLimit(limit)) {
    return NextResponse.json(
      { error: "Spend limit must be greater than zero and no more than 5,000,000 minor units." },
      { status: 400 },
    )
  }

  if (!isValidCardCurrency(body.currency)) {
    return NextResponse.json(
      { error: "Currency must be USD, EUR, or GBP." },
      { status: 400 },
    )
  }

  if (body.category !== undefined && !isValidCardCategory(body.category)) {
    return NextResponse.json({ error: "Unrecognized merchant category." }, { status: 400 })
  }

  const idempotencyKey =
    typeof body.idempotencyKey === "string" && body.idempotencyKey.trim()
      ? body.idempotencyKey.trim()
      : undefined

  const { card, number, duplicate } = createCard({
    nickname,
    merchantId: merchant.id,
    limit,
    currency: body.currency,
    category: body.category,
    idempotencyKey,
  })

  // A retried request returns the card already issued, not a second one —
  // 200 because nothing new was created, 201 the one time something was.
  return NextResponse.json({ card, number, duplicate }, { status: duplicate ? 200 : 201 })
}
