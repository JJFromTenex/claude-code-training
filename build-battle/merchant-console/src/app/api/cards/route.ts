import { merchantById } from "@/data/merchants"
import { listCards } from "@/data/queries"
import { store } from "@/data/store"
import { Card, Currency, MerchantCategory } from "@/data/types"
import {
  MAX_LIMIT_MINOR_UNITS,
  generateCardNumber,
} from "@/lib/cards"
import { NextRequest, NextResponse } from "next/server"

/**
 * Cards route.
 *
 * GET  — list every card, newest first. Never returns the full number; only
 *        last4 + reference are on the record.
 * POST — issue a card. Server-side allowlists everything from the body,
 *        generates the number on the 4242 BIN, and returns the full number
 *        exactly once so the caller can render the reveal screen.
 */

const CURRENCIES: readonly Currency[] = ["USD", "EUR", "GBP"]
const CATEGORIES: readonly MerchantCategory[] = [
  "advertising",
  "software",
  "travel",
  "office",
  "contractors",
  "any",
]

interface IssueBody {
  nickname?: unknown
  merchantId?: unknown
  limit?: unknown
  currency?: unknown
  category?: unknown
}

function bad(message: string) {
  return NextResponse.json({ message }, { status: 400 })
}

export function GET() {
  return NextResponse.json({ cards: listCards() })
}

export async function POST(request: NextRequest) {
  let body: IssueBody
  try {
    body = await request.json()
  } catch {
    return bad("Body must be JSON")
  }

  const nickname =
    typeof body.nickname === "string" ? body.nickname.trim() : ""
  if (!nickname) return bad("Nickname is required")
  if (nickname.length > 60) return bad("Nickname is too long (max 60)")

  const merchantId =
    typeof body.merchantId === "string" ? body.merchantId : ""
  if (!merchantId) return bad("Merchant is required")
  const merchant = merchantById(merchantId)
  if (!merchant) return bad("Unknown merchant")

  if (typeof body.limit !== "number" || !Number.isInteger(body.limit)) {
    return bad("Limit must be an integer in minor units")
  }
  if (body.limit <= 0) return bad("Limit must be greater than zero")
  if (body.limit > MAX_LIMIT_MINOR_UNITS) {
    return bad(
      `Limit exceeds the maximum of ${MAX_LIMIT_MINOR_UNITS} minor units`,
    )
  }

  const currency = body.currency
  if (typeof currency !== "string" || !CURRENCIES.includes(currency as Currency)) {
    return bad("Currency must be USD, EUR, or GBP")
  }

  const rawCategory = body.category ?? "any"
  if (
    typeof rawCategory !== "string" ||
    !CATEGORIES.includes(rawCategory as MerchantCategory)
  ) {
    return bad("Unknown category")
  }
  const category = rawCategory as MerchantCategory

  const generated = generateCardNumber()
  const now = new Date().toISOString()
  const card: Card = {
    id: `card_${Math.random().toString(36).slice(2, 10)}`,
    nickname,
    merchantId,
    limit: body.limit,
    currency: currency as Currency,
    status: "active",
    last4: generated.last4,
    reference: generated.reference,
    category,
    createdAt: now,
  }
  store.cards.push(card)

  // The full number leaves the server exactly here and is never stored.
  return NextResponse.json({ card, full: generated.full }, { status: 201 })
}
