import { cardById } from "@/data/queries"
import { NextResponse } from "next/server"

/** Card records carry last4 only; the full number is never in this payload. */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const card = cardById(id)
  if (!card) {
    return NextResponse.json({ message: "Card not found." }, { status: 404 })
  }
  return NextResponse.json({ card })
}
