import { issueCard, listCards } from "@/data/cards"
import { merchants } from "@/data/merchants"
import { validateIssueInput } from "@/lib/cards"
import { NextRequest, NextResponse } from "next/server"

/** Masked list. Never contains a full number; the Card type has no field for one. */
export function GET() {
  return NextResponse.json({ rows: listCards() })
}

/**
 * Issue a card. The only response in the application that carries the full
 * number. Validation is here, against allowlists, regardless of what the
 * client checked.
 */
export async function POST(request: NextRequest) {
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Request body must be JSON." }, { status: 400 })
  }

  const result = validateIssueInput(body, merchants.map((m) => m.id))
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 400 })
  }

  const { card, number } = issueCard(result.value)
  return NextResponse.json({ card, number }, { status: 201 })
}
