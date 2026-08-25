import { isValidLuhn } from "@/lib/cards"
import { NextRequest } from "next/server"
import { describe, expect, it } from "vitest"
import { PATCH } from "./[id]/status/route"
import { GET, POST } from "./route"

/**
 * The route handlers, called the way a curl past the form calls them. The
 * client is not trusted, so every rejection is proven here rather than in the
 * component that happens to prevent it.
 */

const VALID = {
  nickname: "Meta Ads",
  merchantId: "mch_01",
  spendLimit: 25000,
  currency: "USD",
  category: "advertising",
}

function post(body: unknown, idempotencyKey?: string) {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  }
  if (idempotencyKey) headers["Idempotency-Key"] = idempotencyKey

  return POST(
    new NextRequest("http://localhost/api/cards", {
      method: "POST",
      headers,
      body: JSON.stringify(body),
    }),
  )
}

function patch(id: string, body: unknown) {
  return PATCH(
    new NextRequest(`http://localhost/api/cards/${id}/status`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }),
    { params: Promise.resolve({ id }) },
  )
}

describe("POST /api/cards", () => {
  it("creates a card and returns the full number exactly once", async () => {
    const response = await post({ ...VALID, nickname: "Route create" })
    expect(response.status).toBe(201)

    const body = await response.json()
    expect(body.cardNumber.startsWith("4242")).toBe(true)
    expect(isValidLuhn(body.cardNumber)).toBe(true)
    expect(body.card.last4).toBe(body.cardNumber.slice(-4))
    expect(body.card.spendLimit).toBe(25000)

    // The list route can never hand the same number back.
    const list = await (await GET()).json()
    expect(JSON.stringify(list)).not.toContain(body.cardNumber)
    const listed = list.cards.find((c: { id: string }) => c.id === body.card.id)
    expect(listed.masked).toBe(`•••• ${body.card.last4}`)
  })

  it("rejects each invalid field with a 400 and a readable message", async () => {
    const cases: [string, unknown][] = [
      ["missing merchant", { ...VALID, merchantId: "" }],
      ["unknown merchant", { ...VALID, merchantId: "mch_99" }],
      ["zero limit", { ...VALID, spendLimit: 0 }],
      ["negative limit", { ...VALID, spendLimit: -25000 }],
      ["limit above the ceiling", { ...VALID, spendLimit: 5_000_001 }],
      ["currency outside the allowlist", { ...VALID, currency: "JPY" }],
      ["currency the merchant does not settle in", { ...VALID, currency: "GBP" }],
      ["missing nickname", { ...VALID, nickname: "" }],
    ]

    for (const [label, body] of cases) {
      const response = await post(body)
      expect(response.status, label).toBe(400)
      expect(typeof (await response.json()).message, label).toBe("string")
    }
  })
})

describe("POST /api/cards idempotency", () => {
  it("a replayed request returns the same card with 200, not a second card", async () => {
    const key = "route-idem-key"
    const first = await post({ ...VALID, nickname: "Double click" }, key)
    expect(first.status).toBe(201)
    const created = await first.json()

    const replay = await post({ ...VALID, nickname: "Double click" }, key)
    expect(replay.status).toBe(200)

    const body = await replay.json()
    expect(body.replayed).toBe(true)
    expect(body.card.id).toBe(created.card.id)
    // Reveal-once outranks a byte-identical response.
    expect(body.cardNumber).toBeNull()

    const list = await (await GET()).json()
    const matches = list.cards.filter(
      (c: { nickname: string }) => c.nickname === "Double click",
    )
    expect(matches).toHaveLength(1)
  })

  it("returns 409 when a key is reused for a genuinely different card", async () => {
    const key = "route-idem-reuse"
    expect((await post({ ...VALID, nickname: "First" }, key)).status).toBe(201)

    const conflict = await post(
      {
        nickname: "Different",
        merchantId: "mch_04",
        spendLimit: 500000,
        currency: "GBP",
        category: "travel",
      },
      key,
    )
    expect(conflict.status).toBe(409)
    expect((await conflict.json()).message).toContain("idempotency key")

    const list = await (await GET()).json()
    expect(
      list.cards.filter((c: { nickname: string }) => c.nickname === "Different"),
    ).toHaveLength(0)
  })
})

describe("PATCH /api/cards/[id]/status", () => {
  async function issued() {
    const body = await (await post({ ...VALID, nickname: "Route status" })).json()
    return body.card.id as string
  }

  it("freezes and unfreezes", async () => {
    const id = await issued()
    expect((await patch(id, { status: "frozen" })).status).toBe(200)
    const back = await patch(id, { status: "active" })
    expect(back.status).toBe(200)
    expect((await back.json()).card.status).toBe("active")
  })

  it("returns 409 when the transition is not one the machine allows", async () => {
    const id = await issued()
    expect((await patch(id, { status: "cancelled" })).status).toBe(200)

    const revive = await patch(id, { status: "active" })
    expect(revive.status).toBe(409)
    expect((await revive.json()).message).toContain("cancelled")
  })

  it("returns 400 for a status outside the allowlist", async () => {
    const id = await issued()
    expect((await patch(id, { status: "expired" })).status).toBe(400)
    expect((await patch(id, {})).status).toBe(400)
  })

  it("returns 404 for a card that does not exist", async () => {
    expect((await patch("card_9999", { status: "frozen" })).status).toBe(404)
  })
})
