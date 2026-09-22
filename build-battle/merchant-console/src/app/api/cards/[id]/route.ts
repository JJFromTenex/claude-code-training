import { cardById } from "@/data/card-queries"
import { jsonError } from "@/lib/api"
import { NextResponse } from "next/server"

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const card = cardById(id)
  if (!card) return jsonError(404, "No card with that id.")
  return NextResponse.json(card)
}
