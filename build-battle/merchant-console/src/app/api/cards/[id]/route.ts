import { merchantById } from "@/data/merchants"
import { store } from "@/data/store"
import { NextResponse } from "next/server"

/**
 * GET /api/cards/:id — Get a single card by ID (no full number, only last4)
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const card = store.cards.find((c) => c.id === id)

  if (!card) {
    return NextResponse.json({ error: "Card not found" }, { status: 404 })
  }

  // Resolve merchant name
  const merchant = merchantById(card.merchantId)
  const merchantName = merchant?.name ?? card.merchantId

  return NextResponse.json({
    ...card,
    merchantName,
  })
}
