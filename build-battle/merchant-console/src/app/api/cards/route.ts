import { merchantById } from "@/data/merchants"
import { cardsList } from "@/data/queries"
import { store } from "@/data/store"
import { Card, CardCategory, Currency } from "@/data/types"
import {
  CARD_CATEGORIES,
  generateCardNumber,
  SPEND_LIMIT_CEILING,
} from "@/lib/cards"
import { parseAmountToMinorUnits } from "@/lib/money"
import { NextRequest, NextResponse } from "next/server"

const CURRENCIES: readonly Currency[] = ["USD", "EUR", "GBP"]

/** Card records carry last4 only, so the list payload can never leak a PAN. */
export function GET() {
  return NextResponse.json({ rows: cardsList() })
}

/**
 * Issue a card. Everything in the body is client input and is checked
 * against an allowlist before it reaches the store — the client's own
 * validation is a convenience, never the enforcement. The response is the
 * one and only payload that ever contains the full number.
 */
export async function POST(request: NextRequest) {
  let body: Record<string, unknown>
  try {
    body = await request.json()
  } catch {
    return reject("Request body must be JSON.")
  }

  const nickname = typeof body.nickname === "string" ? body.nickname.trim() : ""
  if (!nickname) return reject("Nickname is required.")
  if (nickname.length > 60) return reject("Nickname must be 60 characters or fewer.")

  const merchantId = typeof body.merchantId === "string" ? body.merchantId : ""
  if (!merchantId || !merchantById(merchantId)) {
    return reject("Choose a merchant. The card must belong to one.")
  }

  // The limit arrives as major-unit input like "250.00" and is converted to
  // integer minor units here, at the boundary, once (src/lib/money.ts).
  const spendLimit =
    typeof body.spendLimit === "string"
      ? parseAmountToMinorUnits(body.spendLimit)
      : null
  if (spendLimit === null) {
    return reject("Spend limit must be a positive amount like 250.00.")
  }
  if (spendLimit <= 0) {
    return reject("Spend limit must be greater than zero.")
  }
  if (spendLimit > SPEND_LIMIT_CEILING) {
    return reject("Spend limit cannot exceed 5,000,000 minor units.")
  }

  const currency = body.currency
  if (!CURRENCIES.includes(currency as Currency)) {
    return reject("Currency must be USD, EUR, or GBP.")
  }

  const categoryLock = body.categoryLock ?? null
  if (
    categoryLock !== null &&
    !CARD_CATEGORIES.includes(categoryLock as CardCategory)
  ) {
    return reject("Category lock must be one of the known categories.")
  }

  // Generated server-side on the 4242 test BIN. Only the last four and an
  // opaque reference are stored; the full number lives in this response
  // and nowhere else.
  const fullNumber = generateCardNumber()
  const card: Card = {
    id: `card_${crypto.randomUUID().slice(0, 8)}`,
    merchantId,
    nickname,
    last4: fullNumber.slice(-4),
    numberReference: `cref_${crypto.randomUUID().replace(/-/g, "").slice(0, 12)}`,
    spendLimit,
    spent: 0,
    currency: currency as Currency,
    status: "active",
    categoryLock: categoryLock as CardCategory | null,
    // Stored in UTC, like every timestamp in the store.
    createdAt: new Date().toISOString(),
  }
  store.cards.push(card)

  return NextResponse.json({ card, fullNumber }, { status: 201 })
}

function reject(message: string) {
  return NextResponse.json({ message }, { status: 400 })
}
