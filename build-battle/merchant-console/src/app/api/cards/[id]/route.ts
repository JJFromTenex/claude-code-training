import { cardByIdRecord, changeCardStatus, toCardPayload } from "@/data/cards"
import { CardStatus } from "@/data/types"
import { NextRequest, NextResponse } from "next/server"

const STATUSES: readonly CardStatus[] = ["active", "frozen", "cancelled"]

type RouteContext = { params: Promise<{ id: string }> }

export async function GET(_request: NextRequest, { params }: RouteContext) {
  const { id } = await params
  const card = cardByIdRecord(id)
  if (!card) {
    return NextResponse.json({ message: "Card not found" }, { status: 404 })
  }
  return NextResponse.json(toCardPayload(card))
}

export async function PATCH(request: NextRequest, { params }: RouteContext) {
  const { id } = await params

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json(
      { message: "Request body must be valid JSON" },
      { status: 400 },
    )
  }

  if (typeof body !== "object" || body === null) {
    return NextResponse.json(
      { message: "Request body must be a JSON object" },
      { status: 400 },
    )
  }

  const { status } = body as Record<string, unknown>
  if (typeof status !== "string" || !STATUSES.includes(status as CardStatus)) {
    return NextResponse.json(
      { message: "Status must be one of active, frozen, cancelled" },
      { status: 400 },
    )
  }

  const result = changeCardStatus(id, status as CardStatus)

  if (!result.ok) {
    if (result.reason === "not_found") {
      return NextResponse.json({ message: "Card not found" }, { status: 404 })
    }
    return NextResponse.json({ message: result.message }, { status: 409 })
  }

  return NextResponse.json(toCardPayload(result.card))
}
