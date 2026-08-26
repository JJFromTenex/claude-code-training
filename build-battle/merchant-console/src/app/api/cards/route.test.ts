import { isValidLuhn } from "@/lib/cards"
import { NextRequest } from "next/server"
import { describe, expect, it } from "vitest"
import { PATCH } from "./[id]/status/route"
import { GET, POST } from "./route"

/** The handlers, called the way a curl past the form calls them. */

const VALID = {
  nickname: "Meta Ads",
  merchantId: "mch_01",
  spendLimit: 25000,
  currency: "USD",
  category: "advertising",
}

const post = (body: unknown, key?: string) =>
  POST(
    new NextRequest("http://localhost/api/cards", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(key && { "Idempotency-Key": key }),
      },
      body: JSON.stringify(body),
    }),
  )

const patch = (id: string, body: unknown) =>
  PATCH(
    new NextRequest(`http://localhost/api/cards/${id}/status`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }),
    { params: Promise.resolve({ id }) },
  )

const cards = async () => (await (await GET()).json()).cards
const named = async (n: string) =>
  (await cards()).filter((c: { nickname: string }) => c.nickname === n)
const issue = async (n: string) =>
  (await (await post({ ...VALID, nickname: n })).json()).card.id as string

describe("POST /api/cards", () => {
  it("returns the full number exactly once, and never again", async () => {
    const res = await post({ ...VALID, nickname: "Route create" })
    expect(res.status).toBe(201)
    expect(res.headers.get("Cache-Control")).toBe("no-store")

    const { card, cardNumber } = await res.json()
    expect(cardNumber.startsWith("4242")).toBe(true)
    expect(isValidLuhn(cardNumber)).toBe(true)
    expect(card.last4).toBe(cardNumber.slice(-4))
    expect(card.spendLimit).toBe(25000)

    // The list route can never hand the same number back.
    const list = await cards()
    expect(JSON.stringify(list)).not.toContain(cardNumber)
    expect(list.find((c: { id: string }) => c.id === card.id).masked).toBe(
      `•••• ${card.last4}`,
    )
  })

  // The client is not trusted: each of these is proven at the handler.
  it.each([
    ["missing merchant", { merchantId: "" }],
    ["unknown merchant", { merchantId: "mch_99" }],
    ["missing nickname", { nickname: "" }],
    ["zero limit", { spendLimit: 0 }],
    ["negative limit", { spendLimit: -25000 }],
    ["limit above the ceiling", { spendLimit: 5_000_001 }],
    ["limit as a currency string", { spendLimit: "$250.00" }],
    ["currency outside the allowlist", { currency: "JPY" }],
    ["currency the merchant does not settle in", { currency: "GBP" }],
  ])("rejects %s with a 400 and a readable message", async (label, body) => {
    const res = await post({ ...VALID, ...body })
    expect(res.status, label).toBe(400)
    expect(typeof (await res.json()).message, label).toBe("string")
  })

  it("replays a retry, and refuses a key spent on a different card", async () => {
    const key = "route-idem"
    const first = await post({ ...VALID, nickname: "Double click" }, key)
    expect(first.status).toBe(201)

    const replay = await post({ ...VALID, nickname: "Double click" }, key)
    expect(replay.status).toBe(200)
    const body = await replay.json()
    expect(body.replayed).toBe(true)
    expect(body.card.id).toBe((await first.json()).card.id)
    expect(body.cardNumber).toBeNull() // reveal-once beats a byte-identical reply
    expect(await named("Double click")).toHaveLength(1)

    const conflict = await post(
      {
        ...VALID,
        nickname: "Different",
        merchantId: "mch_04",
        currency: "GBP",
      },
      key,
    )
    expect(conflict.status).toBe(409)
    expect((await conflict.json()).message).toContain("idempotency key")
    expect(await named("Different")).toHaveLength(0)
  })
})

describe("PATCH /api/cards/[id]/status", () => {
  it("moves active ⇄ frozen and refuses to revive a cancelled card", async () => {
    const id = await issue("Route status")
    expect((await patch(id, { status: "frozen" })).status).toBe(200)
    const back = await patch(id, { status: "active" })
    expect(back.status).toBe(200)
    expect((await back.json()).card.status).toBe("active")

    expect((await patch(id, { status: "cancelled" })).status).toBe(200)
    const revive = await patch(id, { status: "active" })
    expect(revive.status).toBe(409)
    expect((await revive.json()).message).toContain("cancelled")
  })

  it("returns 400 for an unknown status and 404 for an unknown card", async () => {
    const id = await issue("Route guards")
    expect((await patch(id, { status: "expired" })).status).toBe(400)
    expect((await patch(id, {})).status).toBe(400)
    expect((await patch("card_9999", { status: "frozen" })).status).toBe(404)
  })
})
