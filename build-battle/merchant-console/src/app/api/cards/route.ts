import { allCards, CARD_CURRENCIES, issueCard } from "@/data/cards"
import { Currency, MerchantCategory } from "@/data/types"
import { parseAmountToMinorUnits } from "@/lib/money"
import { NextRequest } from "next/server"

/**
 * Cards.
 *
 * GET  — list every issued card (masked; never the full number).
 * POST — issue a card. Everything from the client is validated here before it
 *        reaches the store or the number generator. The full card number is in
 *        the response body exactly once, on success.
 */

export function GET() {
  return Response.json({ cards: allCards() })
}

export async function POST(request: NextRequest) {
  let body: Record<string, unknown>
  try {
    body = await request.json()
  } catch {
    return Response.json({ message: "Invalid request body." }, { status: 400 })
  }

  const currency = body.currency
  if (!CARD_CURRENCIES.includes(currency as Currency)) {
    return Response.json(
      { message: "Currency must be USD, EUR, or GBP." },
      { status: 400 },
    )
  }

  // The limit arrives as a string and is parsed to minor units at the boundary,
  // once. issueCard applies the bounds (positive, <= 5,000,000).
  const limit =
    typeof body.limit === "string" ? parseAmountToMinorUnits(body.limit) : null
  if (limit === null) {
    return Response.json(
      { message: "Enter a valid spend limit." },
      { status: 400 },
    )
  }

  const result = issueCard({
    nickname: typeof body.nickname === "string" ? body.nickname : "",
    merchantId: typeof body.merchantId === "string" ? body.merchantId : "",
    spendLimit: limit,
    currency: currency as Currency,
    category: (body.category ?? null) as MerchantCategory | null,
    idempotencyKey: request.headers.get("idempotency-key") ?? undefined,
  })

  if (!result.ok) {
    return Response.json({ message: result.message }, { status: 400 })
  }

  // A replayed key returns the existing card with no number (200); a fresh
  // issue returns the full number exactly once (201).
  return Response.json(
    { card: result.card, number: result.number, duplicate: result.duplicate },
    { status: result.duplicate ? 200 : 201 },
  )
}
