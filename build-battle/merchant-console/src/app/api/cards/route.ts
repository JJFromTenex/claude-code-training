import { insertCard, listCards } from "@/data/cards"
import {
  generateCardNumber,
  newNumberRef,
  validateIssueRequest,
} from "@/lib/cards"
import { NextRequest, NextResponse } from "next/server"

export function GET() {
  return NextResponse.json({ rows: listCards() })
}

/**
 * Issues a card. This is the one response that carries the full number: it is
 * generated here, handed back once, and only the last four and a reference
 * reach the store.
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

  const validation = validateIssueRequest(body)
  if (!validation.ok) {
    return NextResponse.json(
      { message: validation.message, field: validation.field },
      { status: 400 },
    )
  }

  const number = generateCardNumber()
  const card = insertCard({
    ...validation.value,
    last4: number.slice(-4),
    numberRef: newNumberRef(),
  })

  return NextResponse.json({ card, number }, { status: 201 })
}
