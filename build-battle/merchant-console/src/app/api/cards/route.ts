import { issueCard, listCards } from "@/data/cards"
import { CardFilters, CardStatus } from "@/data/types"
import { validateIssueCard } from "@/lib/cards"
import { NextRequest, NextResponse } from "next/server"

/**
 * The cards collection.
 *
 * POST is the only response in the system that carries a full card number,
 * and it carries it once. Every other read — this GET included — returns the
 * record, which holds the last four and a reference and never the number.
 */

const STATUSES: readonly (CardStatus | "all")[] = [
  "all",
  "active",
  "frozen",
  "cancelled",
]

/** Client input, allowlisted before it reaches a query. */
function parseCardFilters(params: URLSearchParams): CardFilters {
  const status = params.get("status")
  const merchantId = params.get("merchantId")
  return {
    status: STATUSES.includes(status as CardStatus)
      ? (status as CardStatus)
      : "all",
    merchantId: merchantId ?? undefined,
  }
}

export function GET(request: NextRequest) {
  const filters = parseCardFilters(request.nextUrl.searchParams)
  return NextResponse.json({ cards: listCards(filters) })
}

export async function POST(request: NextRequest) {
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json(
      { error: "Expected a JSON body." },
      { status: 400 },
    )
  }

  const validated = validateIssueCard(body)
  if (!validated.ok) {
    return NextResponse.json({ error: validated.error }, { status: 400 })
  }

  const { card, number } = issueCard(validated.value)

  // The one time the full number leaves the server. It is not on `card`, and
  // no later request can produce it again.
  return NextResponse.json({ card, number }, { status: 201 })
}
