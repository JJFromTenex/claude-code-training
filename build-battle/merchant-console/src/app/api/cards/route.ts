import { createCard, validateIssueInput } from "@/data/cards"
import { store } from "@/data/store"
import { CardCategory, Currency } from "@/data/types"
import { NextRequest, NextResponse } from "next/server"

export function GET() {
  const cards = store.cards.map((card) => ({
    ...card,
    history: undefined,
  }))
  return NextResponse.json(cards)
}

export async function POST(request: NextRequest) {
  let body: Record<string, unknown>
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ message: "Invalid JSON body." }, { status: 400 })
  }

  const error = validateIssueInput(body)
  if (error) {
    return NextResponse.json(error, { status: 400 })
  }

  const idempotencyKey = request.headers.get("Idempotency-Key") ?? undefined

  const { card, fullNumber } = createCard({
    nickname: body.nickname as string,
    merchantId: body.merchantId as string,
    spendLimit: body.spendLimit as number,
    currency: body.currency as Currency,
    category: (body.category as CardCategory) ?? null,
    idempotencyKey,
  })

  if (!fullNumber) {
    return NextResponse.json(card, { status: 200 })
  }

  return NextResponse.json(
    { ...card, fullNumber },
    { status: 201 },
  )
}
