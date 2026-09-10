import { beforeEach, describe, expect, it } from "vitest"
import { NextRequest } from "next/server"
import { isLuhnValid, MAX_SPEND_LIMIT, TEST_BIN } from "@/lib/cards"
import { store } from "@/data/store"
import { Card } from "@/data/types"
import { GET, POST } from "./route"

/**
 * Handler-level tests for the cards route. This is what `curl` would see,
 * without the dev server: the status codes, the error bodies, and the one
 * response that carries a full number.
 */

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

const valid = {
  nickname: "Ad spend",
  merchantId: "mch_01",
  spendLimit: 25000,
  currency: "USD",
  categoryLock: "advertising",
}

const post = (body: unknown) =>
  POST(
    new NextRequest("http://localhost/api/cards", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: typeof body === "string" ? body : JSON.stringify(body),
    }),
  )

describe("GET /api/cards", () => {
  it("lists every card masked: last four and a reference, never a number", async () => {
    const response = GET()
    expect(response.status).toBe(200)
    const { cards } = await response.json()
    expect(cards.length).toBe(seed.length)
    for (const card of cards) {
      expect(card).not.toHaveProperty("number")
      expect(card.last4).toMatch(/^\d{4}$/)
      expect(card.numberRef).toMatch(/^cn_/)
    }
    expect(JSON.stringify(cards)).not.toMatch(/\d{16}/)
  })
})

describe("POST /api/cards", () => {
  it("issues a card and returns the number exactly once", async () => {
    const response = await post(valid)
    expect(response.status).toBe(201)

    const body = await response.json()
    expect(body.number).toMatch(/^\d{16}$/)
    expect(body.number.startsWith(TEST_BIN)).toBe(true)
    expect(isLuhnValid(body.number)).toBe(true)
    expect(body.card).toMatchObject({
      nickname: "Ad spend",
      merchantId: "mch_01",
      spendLimit: 25000,
      spent: 0,
      currency: "USD",
      status: "active",
      categoryLock: "advertising",
      last4: body.number.slice(-4),
    })
    expect(body.card).not.toHaveProperty("number")

    // The list that follows knows the last four and nothing more.
    const { cards } = await GET().json()
    expect(cards[0].id).toBe(body.card.id)
    expect(JSON.stringify(cards)).not.toContain(body.number)
  })

  it("rejects a body that is not JSON", async () => {
    const response = await post("not json")
    expect(response.status).toBe(400)
    expect(await response.json()).toEqual({ error: "Request body must be JSON." })
  })

  it("rejects a missing merchant", async () => {
    const { merchantId: _drop, ...body } = valid
    const response = await post(body)
    expect(response.status).toBe(400)
    expect(await response.json()).toEqual({ error: "Choose a merchant." })
  })

  it("rejects an unknown merchant", async () => {
    const response = await post({ ...valid, merchantId: "mch_404" })
    expect(response.status).toBe(400)
    expect(await response.json()).toEqual({
      error: "That merchant does not exist.",
    })
  })

  it("rejects a zero or negative limit", async () => {
    expect((await post({ ...valid, spendLimit: 0 })).status).toBe(400)
    const response = await post({ ...valid, spendLimit: -500 })
    expect(response.status).toBe(400)
    expect(await response.json()).toEqual({
      error: "Spend limit must be greater than zero.",
    })
  })

  it("rejects a limit above 5,000,000 minor units", async () => {
    const response = await post({ ...valid, spendLimit: MAX_SPEND_LIMIT + 1 })
    expect(response.status).toBe(400)
    expect(await response.json()).toEqual({
      error: "Spend limit cannot exceed $50,000.00.",
    })
  })

  it("rejects a limit that is a float or a string", async () => {
    expect((await post({ ...valid, spendLimit: 250.5 })).status).toBe(400)
    expect((await post({ ...valid, spendLimit: "25000" })).status).toBe(400)
    expect((await post({ ...valid, spendLimit: "$250.00" })).status).toBe(400)
  })

  it("rejects a currency outside USD, EUR, GBP", async () => {
    const response = await post({ ...valid, currency: "CHF" })
    expect(response.status).toBe(400)
    expect(await response.json()).toEqual({
      error: "Currency must be USD, EUR, or GBP.",
    })
  })

  it("rejects a category outside the allowlist", async () => {
    const response = await post({ ...valid, categoryLock: "casinos" })
    expect(response.status).toBe(400)
  })

  it("writes nothing to the store when it rejects", async () => {
    const before = store.cards.length
    await post({ ...valid, currency: "CHF" })
    await post({ ...valid, spendLimit: 0 })
    expect(store.cards.length).toBe(before)
  })
})
