import { issueCard, listCards, parseIssue } from "@/data/cards"
import { NextRequest, NextResponse } from "next/server"

/** One error shape: a status that means what it says, and a safe message. */
const fail = (status: number, message: string) =>
  NextResponse.json({ message }, { status })

/** Built from Card records, which have no field for a number to leak. */
export function GET() {
  return NextResponse.json({ cards: listCards() })
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null)

  const values = parseIssue(body)
  if ("message" in values) return fail(values.status, values.message)

  const issued = issueCard(values, request.headers.get("idempotency-key"))
  if ("message" in issued) return fail(issued.status, issued.message)

  // 201 with the number on a fresh issue; 200 and no number on a replay.
  const replayed = issued.fullNumber === null
  return NextResponse.json(
    { card: issued.card, fullNumber: issued.fullNumber, replayed },
    { status: replayed ? 200 : 201 },
  )
}
