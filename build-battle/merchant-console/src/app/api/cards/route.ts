import { issueCard } from "@/data/cards"
import { merchantById } from "@/data/merchants"
import { Currency } from "@/data/types"
import { CARD_CATEGORIES, MAX_SPEND_LIMIT } from "@/lib/cards"
import { formatMoney } from "@/lib/money"
import { NextRequest, NextResponse } from "next/server"

const CURRENCIES = ["USD", "EUR", "GBP"] as const

/**
 * Issues a virtual card. The client is not trusted: everything is checked
 * against an allowlist before it reaches the store. The response is the
 * one and only time the full number leaves the server.
 */
export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null)
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 })
  }

  const { merchantId, nickname, spendLimit, currency, categoryLock } = body as {
    merchantId?: unknown
    nickname?: unknown
    spendLimit?: unknown
    currency?: unknown
    categoryLock?: unknown
  }

  if (typeof merchantId !== "string" || !merchantById(merchantId)) {
    return NextResponse.json({ error: "Choose a merchant." }, { status: 400 })
  }
  if (
    typeof nickname !== "string" ||
    nickname.trim() === "" ||
    nickname.trim().length > 40
  ) {
    return NextResponse.json(
      { error: "Give the card a nickname of up to 40 characters." },
      { status: 400 },
    )
  }
  if (
    typeof currency !== "string" ||
    !CURRENCIES.includes(currency as Currency)
  ) {
    return NextResponse.json(
      { error: "Currency must be USD, EUR, or GBP." },
      { status: 400 },
    )
  }
  if (typeof spendLimit !== "number" || !Number.isInteger(spendLimit) || spendLimit <= 0) {
    return NextResponse.json(
      { error: "Spend limit must be a positive amount." },
      { status: 400 },
    )
  }
  if (spendLimit > MAX_SPEND_LIMIT) {
    return NextResponse.json(
      {
        error: `Spend limit cannot exceed ${formatMoney(MAX_SPEND_LIMIT, currency as Currency)}.`,
      },
      { status: 400 },
    )
  }
  if (
    categoryLock != null &&
    !CARD_CATEGORIES.includes(categoryLock as (typeof CARD_CATEGORIES)[number])
  ) {
    return NextResponse.json(
      { error: "Unknown merchant category." },
      { status: 400 },
    )
  }

  const { card, fullNumber } = issueCard({
    merchantId,
    nickname: nickname.trim(),
    spendLimit,
    currency: currency as Currency,
    categoryLock: (categoryLock as string | null | undefined) ?? null,
  })

  return NextResponse.json({ card, fullNumber }, { status: 201 })
}
