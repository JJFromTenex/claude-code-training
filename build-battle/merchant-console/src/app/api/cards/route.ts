import {
  cardByRequestId,
  issueCard,
  listCards,
  toCardPayload,
} from "@/data/cards"
import { merchantById } from "@/data/merchants"
import { CardCategory, Currency } from "@/data/types"
import { NextRequest, NextResponse } from "next/server"

const CURRENCIES: readonly Currency[] = ["USD", "EUR", "GBP"]
const CATEGORIES: readonly CardCategory[] = [
  "ads",
  "subscriptions",
  "contractor_tools",
  "travel",
  "office",
]
const MAX_SPEND_LIMIT = 5_000_000
const MAX_NICKNAME_LENGTH = 60

function badRequest(message: string) {
  return NextResponse.json({ message }, { status: 400 })
}

export function GET() {
  return NextResponse.json(listCards().map(toCardPayload))
}

/**
 * Validates the request against an allowlist before anything reaches the
 * store, mirroring parseFilters — client input is a convenience, never the
 * enforcement.
 */
export async function POST(request: NextRequest) {
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return badRequest("Request body must be valid JSON")
  }

  if (typeof body !== "object" || body === null) {
    return badRequest("Request body must be a JSON object")
  }

  const { nickname, merchantId, spendLimit, currency, category, requestId } =
    body as Record<string, unknown>

  const trimmedNickname = typeof nickname === "string" ? nickname.trim() : ""
  if (!trimmedNickname || trimmedNickname.length > MAX_NICKNAME_LENGTH) {
    return badRequest(
      `Nickname is required and must be ${MAX_NICKNAME_LENGTH} characters or fewer`,
    )
  }

  if (typeof merchantId !== "string" || !merchantId) {
    return badRequest("Merchant is required")
  }
  const merchant = merchantById(merchantId)
  if (!merchant) {
    return badRequest("Merchant not found")
  }

  if (
    typeof spendLimit !== "number" ||
    !Number.isInteger(spendLimit) ||
    spendLimit <= 0 ||
    spendLimit > MAX_SPEND_LIMIT
  ) {
    return badRequest(
      `Spend limit must be a whole number of minor units greater than 0 and at most ${MAX_SPEND_LIMIT}`,
    )
  }

  if (
    typeof currency !== "string" ||
    !CURRENCIES.includes(currency as Currency)
  ) {
    return badRequest("Currency must be one of USD, EUR, GBP")
  }

  if (
    typeof category !== "string" ||
    !CATEGORIES.includes(category as CardCategory)
  ) {
    return badRequest("Category is not recognized")
  }

  if (typeof requestId !== "string" || !requestId) {
    return badRequest("A request id is required")
  }

  if (currency !== merchant.currency) {
    return NextResponse.json(
      {
        message: `Currency (${currency}) must match the merchant's currency (${merchant.currency})`,
      },
      { status: 422 },
    )
  }

  // Idempotent: replaying the same request never mints a second card or
  // re-reveals the number.
  const existing = cardByRequestId(requestId)
  if (existing) {
    return NextResponse.json(
      { message: "This request was already processed", cardId: existing.id },
      { status: 409 },
    )
  }

  const { card, fullNumber } = issueCard({
    merchantId,
    nickname: trimmedNickname,
    spendLimit,
    currency: currency as Currency,
    category: category as CardCategory,
    requestId,
  })

  return NextResponse.json(
    { card: toCardPayload(card), fullNumber },
    { status: 201 },
  )
}
