import {
  CARD_CATEGORIES,
  CARD_LIMIT_MAX_MINOR_UNITS,
  cardByRequestId,
  issueCard,
} from "@/data/cards"
import { merchantById } from "@/data/merchants"
import { CardCategory, Currency } from "@/data/types"
import { NextRequest, NextResponse } from "next/server"

/**
 * Issues a virtual card.
 *
 * This is the only response in the application that carries a full card
 * number. The stored record keeps the last four and a reference, so no later
 * read can return it, including the idempotent replay below.
 *
 * Everything on the body is checked against an allowlist first. The drawer
 * performs the same checks, but those are a convenience and this is the
 * enforcement.
 */

const CURRENCIES: readonly Currency[] = ["USD", "EUR", "GBP"]

const NICKNAME_MAX_LENGTH = 60

function badRequest(message: string) {
  return NextResponse.json({ message }, { status: 400 })
}

export async function POST(request: NextRequest) {
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return badRequest("Request body must be JSON.")
  }

  const input = (body ?? {}) as Record<string, unknown>

  const requestId = typeof input.requestId === "string" ? input.requestId : ""
  if (!requestId) {
    return badRequest("A requestId is required so a retry cannot double-issue.")
  }

  // A replayed token returns the card it already made, without the number:
  // the reveal happened on the first response and does not happen twice.
  const existing = cardByRequestId(requestId)
  if (existing) {
    return NextResponse.json({ card: existing }, { status: 200 })
  }

  const nickname =
    typeof input.nickname === "string" ? input.nickname.trim() : ""
  if (!nickname) {
    return badRequest("Give the card a nickname so ops can recognise it.")
  }
  if (nickname.length > NICKNAME_MAX_LENGTH) {
    return badRequest(
      `Nicknames are at most ${NICKNAME_MAX_LENGTH} characters.`,
    )
  }

  const merchant =
    typeof input.merchantId === "string" ? merchantById(input.merchantId) : null
  if (!merchant) {
    return badRequest("Choose a merchant this card belongs to.")
  }

  const limit = input.limit
  if (typeof limit !== "number" || !Number.isInteger(limit)) {
    return badRequest("The spend limit must be a whole number of minor units.")
  }
  if (limit <= 0) {
    return badRequest("The spend limit must be greater than zero.")
  }
  if (limit > CARD_LIMIT_MAX_MINOR_UNITS) {
    return badRequest(
      `The spend limit cannot exceed ${CARD_LIMIT_MAX_MINOR_UNITS} minor units.`,
    )
  }

  const currency = input.currency as Currency
  if (!CURRENCIES.includes(currency)) {
    return badRequest("Currency must be one of USD, EUR, or GBP.")
  }
  // A card settles in the merchant's currency. Anything else would put an
  // amount and a currency code on the same record that do not belong together.
  if (currency !== merchant.currency) {
    return badRequest(
      `${merchant.name} settles in ${merchant.currency}, so the card cannot be issued in ${currency}.`,
    )
  }

  const category = input.category as CardCategory
  if (!CARD_CATEGORIES.includes(category)) {
    return badRequest("Choose a category to lock the card to.")
  }

  const { card, fullNumber } = issueCard({
    merchantId: merchant.id,
    nickname,
    limit,
    currency,
    category,
    requestId,
  })

  return NextResponse.json({ card, fullNumber }, { status: 201 })
}
