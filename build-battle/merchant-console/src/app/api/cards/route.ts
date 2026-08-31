import {
  CARD_CURRENCIES,
  MAX_SPEND_LIMIT,
  issueCard,
  listCards,
  parseCardInput,
} from "@/data/cards"
import { NextRequest, NextResponse } from "next/server"

/**
 * Issue and list virtual cards (NWP-201).
 *
 * `POST` is the only response in the application that carries a full card
 * number, and it carries it exactly once. `GET` returns records that hold the
 * last four and nothing more, so there is no number here to leak.
 *
 * Every field on the way in is validated in `parseCardInput` against an
 * allowlist. The dialog's own checks are a convenience, never the enforcement.
 */

export async function POST(request: NextRequest) {
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json(
      { message: "Expected a JSON body." },
      { status: 400 },
    )
  }

  const parsed = parseCardInput(body)
  if (!parsed.ok) {
    return NextResponse.json({ message: parsed.error }, { status: 400 })
  }

  const { card, number } = issueCard(parsed.value)

  // The one and only time a full number leaves the server.
  return NextResponse.json({ card, number }, { status: 201 })
}

export function GET() {
  return NextResponse.json({
    cards: listCards(),
    currencies: CARD_CURRENCIES,
    maxSpendLimit: MAX_SPEND_LIMIT,
  })
}
