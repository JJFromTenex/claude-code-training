import {
  allCards,
  issueCard,
  parseIssueCardInput,
  withSpend,
} from "@/data/card-queries"
import { NextRequest, NextResponse } from "next/server"

/**
 * Errors share one shape across every card route: a status code that means
 * what it says and a message safe to put in front of an operator.
 */
function fail(message: string, status: number, field?: string) {
  return NextResponse.json({ message, field }, { status })
}

/** The list. Cards carry a last four and never a full number. */
export function GET() {
  return NextResponse.json({ rows: allCards().map(withSpend) })
}

/**
 * Issue a card.
 *
 * The one response in the entire application that contains a full card number.
 * It is generated here, handed back once, and never written to the record.
 */
export async function POST(request: NextRequest) {
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return fail("Send a card to issue.", 400)
  }

  const parsed = parseIssueCardInput(body)
  if (!parsed.ok) {
    return fail(parsed.error.message, 400, parsed.error.field)
  }

  const { card, number } = issueCard(parsed.value)
  return NextResponse.json({ card: withSpend(card), number }, { status: 201 })
}
