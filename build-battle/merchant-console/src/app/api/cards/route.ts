import { issueCard, listCards } from "@/data/cards"
import { merchantById } from "@/data/merchants"
import { parseAmountToMinorUnits } from "@/lib/money"
import { Currency } from "@/data/types"
import { NextRequest, NextResponse } from "next/server"

const CURRENCIES: readonly Currency[] = ["USD", "EUR", "GBP"]
const MAX_LIMIT_MINOR = 5_000_000

function bad(message: string) {
  return NextResponse.json({ message }, { status: 400 })
}

/** GET /api/cards — every issued card, masked (records carry last4 only). */
export function GET() {
  return NextResponse.json(listCards())
}

/**
 * POST /api/cards — issue a card.
 *
 * Validates every field server-side against an allowlist; the client is not
 * trusted. The limit arrives as a user-typed amount and is converted to minor
 * units exactly once here. On success the full number is returned once.
 */
export async function POST(request: NextRequest) {
  let body: Record<string, unknown>
  try {
    body = await request.json()
  } catch {
    return bad("Request body must be JSON.")
  }

  const nickname = typeof body.nickname === "string" ? body.nickname.trim() : ""
  if (!nickname) return bad("A nickname is required.")

  const merchantId = typeof body.merchantId === "string" ? body.merchantId : ""
  if (!merchantId || !merchantById(merchantId)) {
    return bad("A valid merchant is required.")
  }

  const currency = body.currency
  if (typeof currency !== "string" || !CURRENCIES.includes(currency as Currency)) {
    return bad("Currency must be one of USD, EUR, GBP.")
  }

  // The limit may arrive as a string ("250.00") or a number; normalize, then
  // convert to minor units once at this boundary.
  const rawLimit =
    typeof body.limit === "string" || typeof body.limit === "number"
      ? String(body.limit)
      : ""
  const limit = parseAmountToMinorUnits(rawLimit)
  if (limit === null || limit <= 0) {
    return bad("Spend limit must be a positive amount.")
  }
  if (limit > MAX_LIMIT_MINOR) {
    return bad("Spend limit cannot exceed 5,000,000 minor units.")
  }

  const { card, fullNumber } = issueCard({
    nickname,
    merchantId,
    limit,
    currency: currency as Currency,
  })

  return NextResponse.json({ card, fullNumber }, { status: 201 })
}
