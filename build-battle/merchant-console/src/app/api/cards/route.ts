import { issueCard } from "@/data/cards"
import { validateIssueCardInput } from "@/lib/cards"
import { NextRequest, NextResponse } from "next/server"

/**
 * Issues a virtual card.
 *
 * The full number is returned exactly once, in this response body. After
 * this, the card record carries only the last four — never the full PAN.
 */
export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null)
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 })
  }

  const validation = validateIssueCardInput(body)
  if (!validation.valid) {
    return NextResponse.json({ error: validation.error }, { status: 400 })
  }

  const { card, fullNumber } = issueCard(validation.data)
  return NextResponse.json({ card, fullNumber }, { status: 201 })
}
