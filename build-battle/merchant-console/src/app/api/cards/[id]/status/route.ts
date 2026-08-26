import { transitionCard } from "@/data/cards"
import { NextRequest, NextResponse } from "next/server"

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json(
      { message: "Request body must be valid JSON." },
      { status: 400 },
    )
  }

  const to = (body as Record<string, unknown> | null)?.status
  const result = transitionCard(id, to)
  if (!result.ok) {
    return NextResponse.json(
      { message: result.error, card: result.card },
      { status: result.status },
    )
  }
  return NextResponse.json({ card: result.card })
}
