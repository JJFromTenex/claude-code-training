import { beforeEach, describe, expect, it } from "vitest"
import { NextRequest } from "next/server"
import { issueCard } from "@/data/cards"
import { store } from "@/data/store"
import { Card } from "@/data/types"
import { GET, PATCH } from "./route"

const seed: Card[] = store.cards.map((card) => ({
  ...card,
  events: [...card.events],
}))

beforeEach(() => {
  store.cards.splice(0, store.cards.length, ...seed.map((card) => ({
    ...card,
    events: [...card.events],
  })))
})

const context = (id: string) => ({ params: Promise.resolve({ id }) })

const get = (id: string) =>
  GET(new NextRequest(`http://localhost/api/cards/${id}`), context(id))

const patch = (id: string, body: unknown) =>
  PATCH(
    new NextRequest(`http://localhost/api/cards/${id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: typeof body === "string" ? body : JSON.stringify(body),
    }),
    context(id),
  )

const fresh = () =>
  issueCard({
    nickname: "Ad spend",
    merchantId: "mch_01",
    spendLimit: 25000,
    currency: "USD",
    categoryLock: null,
  })

describe("GET /api/cards/[id]", () => {
  it("returns the masked record", async () => {
    const { card, number } = fresh()
    const response = await get(card.id)
    expect(response.status).toBe(200)
    const body = await response.json()
    expect(body.card.id).toBe(card.id)
    expect(body.card.last4).toBe(number.slice(-4))
    expect(body.card).not.toHaveProperty("number")
    expect(JSON.stringify(body)).not.toContain(number)
  })

  it("404s for an unknown id", async () => {
    const response = await get("card_999999")
    expect(response.status).toBe(404)
    expect(await response.json()).toEqual({ error: "No card with that id." })
  })
})

describe("PATCH /api/cards/[id]", () => {
  it("freezes an active card and unfreezes it again, never returning a number", async () => {
    const { card, number } = fresh()

    const frozen = await patch(card.id, { status: "frozen" })
    expect(frozen.status).toBe(200)
    const frozenBody = await frozen.json()
    expect(frozenBody.card.status).toBe("frozen")
    expect(JSON.stringify(frozenBody)).not.toContain(number)

    const active = await patch(card.id, { status: "active" })
    expect(active.status).toBe(200)
    expect((await active.json()).card.status).toBe("active")
    expect(card.events.map((e) => e.type)).toEqual([
      "issued",
      "frozen",
      "unfrozen",
    ])
  })

  it("cancels a card and then refuses every change with a 409", async () => {
    const { card } = fresh()
    expect((await patch(card.id, { status: "cancelled" })).status).toBe(200)

    const response = await patch(card.id, { status: "active" })
    expect(response.status).toBe(409)
    expect(await response.json()).toEqual({
      error: "This card is cancelled. Cancelled cards cannot be changed.",
    })
    expect((await patch(card.id, { status: "frozen" })).status).toBe(409)
    expect(card.status).toBe("cancelled")
  })

  it("409s on a no-op transition with a readable reason", async () => {
    const { card } = fresh()
    const response = await patch(card.id, { status: "active" })
    expect(response.status).toBe(409)
    expect(await response.json()).toEqual({
      error: "This card is already active.",
    })
  })

  it("400s on a status outside the allowlist", async () => {
    const { card } = fresh()
    const response = await patch(card.id, { status: "deleted" })
    expect(response.status).toBe(400)
    expect(await response.json()).toEqual({
      error: "Status must be active, frozen, or cancelled.",
    })
    expect(card.status).toBe("active")
  })

  it("400s on a body that is not JSON", async () => {
    const { card } = fresh()
    expect((await patch(card.id, "{{")).status).toBe(400)
  })

  it("404s for an unknown id", async () => {
    const response = await patch("card_999999", { status: "frozen" })
    expect(response.status).toBe(404)
  })
})
