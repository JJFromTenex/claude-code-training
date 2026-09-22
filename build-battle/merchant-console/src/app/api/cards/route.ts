import { createCard, listCards } from "@/data/cards"
import { merchantById } from "@/data/merchants"
import { Currency } from "@/data/types"
import { NextRequest, NextResponse } from "next/server"

const CURRENCIES: readonly Currency[] = ["USD", "EUR", "GBP"]
const MAX_LIMIT = 5_000_000

export function GET() {
  return NextResponse.json(listCards())
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null)
  if (!body || typeof body !== "object") {
    return NextResponse.json({ message: "Invalid request body" }, { status: 400 })
  }

  const { nickname, merchantId, limit, currency, category } = body as Record<
    string,
    unknown
  >

  if (typeof nickname !== "string" || nickname.trim().length === 0) {
    return NextResponse.json({ message: "Nickname is required" }, { status: 400 })
  }

  if (typeof merchantId !== "string" || !merchantById(merchantId)) {
    return NextResponse.json({ message: "Unknown merchant" }, { status: 400 })
  }

  if (
    typeof limit !== "number" ||
    !Number.isInteger(limit) ||
    limit <= 0 ||
    limit > MAX_LIMIT
  ) {
    return NextResponse.json(
      { message: `Limit must be a whole number of minor units between 1 and ${MAX_LIMIT}` },
      { status: 400 },
    )
  }

  if (typeof currency !== "string" || !CURRENCIES.includes(currency as Currency)) {
    return NextResponse.json({ message: "Unsupported currency" }, { status: 400 })
  }

  const { card, fullNumber } = createCard({
    nickname: nickname.trim(),
    merchantId,
    limit,
    currency: currency as Currency,
    category: typeof category === "string" ? category : undefined,
  })

  return NextResponse.json({ card, fullNumber }, { status: 201 })
}
