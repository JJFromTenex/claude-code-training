import { createCard } from "@/data/cards"
import { merchantById } from "@/data/merchants"
import { CURRENCIES, Currency } from "@/data/types"
import { generateCardNumber } from "@/lib/cards"
import { formatMoney, parseAmountToMinorUnits } from "@/lib/money"
import { NextRequest, NextResponse } from "next/server"

/**
 * Card issuing.
 *
 * There is no GET: the console's pages read the data layer directly, as every
 * other page here does. Nothing in this app fetches its own API.
 *
 * `spendLimit` arrives as a string of major units — what ops typed — and is
 * converted to minor units exactly once, by `parseAmountToMinorUnits`.
 */

/** The ceiling, in minor units. */
const MAX_SPEND_LIMIT = 5_000_000

const badRequest = (error: string) =>
  NextResponse.json({ error }, { status: 400 })

export async function POST(request: NextRequest) {
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return badRequest("Expected a JSON body.")
  }

  const { nickname, merchantId, spendLimit, currency } = (body ?? {}) as Record<
    string,
    unknown
  >

  if (typeof nickname !== "string" || nickname.trim() === "") {
    return badRequest("Give the card a nickname.")
  }

  if (typeof merchantId !== "string" || !merchantById(merchantId)) {
    return badRequest("Choose a merchant that exists.")
  }

  if (
    typeof currency !== "string" ||
    !(CURRENCIES as readonly string[]).includes(currency)
  ) {
    return badRequest(`Currency must be one of ${CURRENCIES.join(", ")}.`)
  }

  if (typeof spendLimit !== "string") {
    return badRequest('Send the spend limit as a string, like "250.00".')
  }

  // Returns null for anything that is not digits with up to two decimals,
  // which is what rejects a negative limit — its pattern has no sign.
  const limit = parseAmountToMinorUnits(spendLimit)
  if (limit === null) {
    return badRequest("Spend limit must be an amount like 250 or 250.00.")
  }
  if (limit <= 0) {
    return badRequest("Spend limit must be greater than zero.")
  }
  if (limit > MAX_SPEND_LIMIT) {
    return badRequest(
      `Spend limit cannot exceed ${formatMoney(MAX_SPEND_LIMIT, currency as Currency)}.`,
    )
  }

  // Generated here, on the server. The card record keeps the last four; this is
  // the only response that will ever carry the full number.
  const number = generateCardNumber()
  const card = createCard({
    nickname: nickname.trim(),
    merchantId,
    last4: number.slice(-4),
    spendLimit: limit,
    currency: currency as Currency,
  })

  return NextResponse.json({ card, number }, { status: 201 })
}
