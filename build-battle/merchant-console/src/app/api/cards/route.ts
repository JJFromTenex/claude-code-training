import { issueCard, listCards, parseIssue } from "@/data/cards"
import { NextRequest, NextResponse } from "next/server"

/**
 * One error shape everywhere: a status code that means what it says and a
 * message safe to put in front of an operator.
 */
const fail = (status: number, message: string) =>
  NextResponse.json({ message }, { status })

/**
 * The list payload is built from Card records, which carry `last4` and a
 * reference and have no field for the number itself. It cannot leak one.
 */
export function GET() {
  return NextResponse.json({ cards: listCards() })
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null)

  const values = parseIssue(body)
  if ("message" in values) return fail(values.status, values.message)

  const issued = issueCard(values, request.headers.get("idempotency-key"))
  if ("message" in issued) return fail(issued.status, issued.message)

  // 201 with the number on a fresh issue; 200 and no number on a replay,
  // because the reveal happens exactly once.
  return NextResponse.json(
    {
      card: issued.card,
      fullNumber: issued.fullNumber,
      replayed: issued.fullNumber === null,
    },
    { status: issued.fullNumber ? 201 : 200 },
  )
}
