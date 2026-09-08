import { createCard, listCards } from "@/data/cards"
import { merchantById } from "@/data/merchants"
import { CardCategory, Currency } from "@/data/types"
import { CARD_CATEGORIES, MAX_SPEND_LIMIT_MINOR } from "@/lib/cards"
import { NextRequest, NextResponse } from "next/server"

/**
 * List and issue cards. Everything the client sends is checked against an
 * allowlist here, because a client-side check is a convenience and never the
 * enforcement. The full number leaves the server in exactly one place: the 201.
 */

const CURRENCIES: readonly Currency[] = ["USD", "EUR", "GBP"]
const MAX_NICKNAME = 40
const MAX_IDEMPOTENCY_KEY = 100
const KEY_CONFLICT =
  "This idempotency key was already used for a different request. Use a fresh key to issue another card."

const reject = (message: string) => NextResponse.json({ message }, { status: 400 })

export function GET() {
  return NextResponse.json({ cards: listCards() })
}

export async function POST(request: NextRequest) {
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return reject("The request body could not be read as JSON.")
  }
  const input = (body ?? {}) as Record<string, unknown>

  const { nickname, merchantId, spendLimit, currency } = input
  if (typeof nickname !== "string" || nickname.trim().length === 0)
    return reject("Give the card a nickname so ops can recognise it later.")
  const trimmedNickname = nickname.trim()
  if (trimmedNickname.length > MAX_NICKNAME)
    return reject(`A nickname can be at most ${MAX_NICKNAME} characters.`)

  if (typeof merchantId !== "string" || merchantId.length === 0)
    return reject("Choose the merchant this card belongs to.")
  const merchant = merchantById(merchantId)
  if (!merchant) return reject("That merchant does not exist.")

  if (!Number.isInteger(spendLimit))
    return reject("The spend limit must be a whole number of minor units.")
  const limit = spendLimit as number
  if (limit <= 0) return reject("The spend limit must be greater than zero.")
  if (limit > MAX_SPEND_LIMIT_MINOR)
    return reject(
      `The spend limit cannot be above ${MAX_SPEND_LIMIT_MINOR.toLocaleString("en-US")} minor units.`,
    )

  if (typeof currency !== "string" || !CURRENCIES.includes(currency as Currency))
    return reject("The currency must be USD, EUR, or GBP.")
  // Stricter than the ticket: a card is issued in its merchant's own currency.
  if (currency !== merchant.currency)
    return reject(
      `${merchant.name} settles in ${merchant.currency}, so this card has to be ${merchant.currency}.`,
    )

  const categoryLock = input.categoryLock ?? null
  if (
    categoryLock !== null &&
    (typeof categoryLock !== "string" ||
      !CARD_CATEGORIES.includes(categoryLock as CardCategory))
  )
    return reject(`A category lock must be one of: ${CARD_CATEGORIES.join(", ")}.`)

  const rawKey = input.idempotencyKey
  if (rawKey !== undefined && (typeof rawKey !== "string" || rawKey.length > MAX_IDEMPOTENCY_KEY))
    return reject(
      `An idempotency key must be text of at most ${MAX_IDEMPOTENCY_KEY} characters.`,
    )

  const result = createCard({
    nickname: trimmedNickname,
    merchantId: merchant.id,
    spendLimit: limit,
    currency: currency as Currency,
    categoryLock: categoryLock as CardCategory | null,
    idempotencyKey: rawKey as string | undefined,
  })

  if ("conflict" in result)
    return NextResponse.json({ message: KEY_CONFLICT }, { status: 409 })
  // A replay is not a creation, and it carries no number.
  if (result.replayed) return NextResponse.json(result)
  return NextResponse.json(result, { status: 201 })
}
