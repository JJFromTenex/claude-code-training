import { issueCard, listCards, parseCardInput } from "@/data/cards"
import { NextRequest, NextResponse } from "next/server"

/**
 * Cards ops has issued. The full number is never in this payload: the
 * records carry the last four and a reference, and nothing else.
 */
export function GET(request: NextRequest) {
  const page = Number(request.nextUrl.searchParams.get("page") ?? "1")
  return NextResponse.json(listCards(Number.isFinite(page) && page > 0 ? page : 1))
}

/**
 * Issues a card. This is the one response in the application that carries a
 * full card number, and it is not readable again afterwards.
 */
export async function POST(request: NextRequest) {
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ message: "Send a JSON body." }, { status: 400 })
  }

  const parsed = parseCardInput(body)
  if ("error" in parsed) {
    return NextResponse.json(
      { message: parsed.error.message },
      { status: parsed.error.status },
    )
  }

  const { card, number } = issueCard(parsed.input)
  return NextResponse.json({ card, number }, { status: 201 })
}
