import { cardById, withSpend } from "@/data/card-queries"
import { NextResponse } from "next/server"

/** One card, with its derived spend. Last four only, never the full number. */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const card = cardById(id)
  if (!card) {
    return NextResponse.json({ message: "No card with that id." }, { status: 404 })
  }

  return NextResponse.json({ card: withSpend(card) })
}
