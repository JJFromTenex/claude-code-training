import { issueCard, listCards, parseIssueCardInput } from "@/data/cards"
import { NextRequest, NextResponse } from "next/server"

export function GET() {
  return NextResponse.json({ rows: listCards() })
}

/**
 * Issues a card. This is the one response that carries the full number; the
 * stored record and every other route carry the last four only.
 */
export async function POST(request: NextRequest) {
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json(
      { message: "Request body must be JSON." },
      { status: 400 },
    )
  }

  const parsed = parseIssueCardInput(body)
  if (!parsed.ok) {
    return NextResponse.json({ message: parsed.message }, { status: 400 })
  }

  return NextResponse.json(issueCard(parsed.value), { status: 201 })
}
