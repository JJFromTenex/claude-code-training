import { NextRequest, NextResponse } from "next/server"
import { issueCard, listCards } from "@/data/cardQueries"

export function GET() {
  return NextResponse.json({ cards: listCards() })
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null)
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 })
  }
  const result = issueCard({
    nickname: String(body.nickname ?? ""),
    merchantId: String(body.merchantId ?? ""),
    category: String(body.category ?? ""),
    limit: String(body.limit ?? ""),
    currency: String(body.currency ?? ""),
    requestId: typeof body.requestId === "string" ? body.requestId : undefined,
  })
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status })
  }
  return NextResponse.json({ card: result.card, number: result.number }, { status: 201 })
}
