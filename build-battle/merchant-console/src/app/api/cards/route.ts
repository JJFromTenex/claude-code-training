import { issueCard, listCards, parseCardInput } from "@/data/card-queries"
import { jsonError } from "@/lib/api"
import { NextRequest, NextResponse } from "next/server"

/**
 * Cards list masked: the Card type has no number field, so a full number
 * cannot leak from here. The create response is the one exception, and the
 * request body is never logged.
 */
export function GET() {
  return NextResponse.json({ cards: listCards() })
}

export async function POST(request: NextRequest) {
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return jsonError(400, "Expected a JSON body.")
  }

  const parsed = parseCardInput(body)
  if ("errors" in parsed) {
    return jsonError(400, "That card could not be issued.", parsed.errors)
  }

  return NextResponse.json(issueCard(parsed.input), { status: 201 })
}
