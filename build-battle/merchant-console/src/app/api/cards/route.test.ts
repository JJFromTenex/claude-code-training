import { NextRequest } from "next/server"
import { describe, expect, it } from "vitest"
import { isValidLuhn } from "@/lib/cards"
import { PATCH } from "./[id]/route"
import { GET, POST } from "./route"

/**
 * The route is where a client's input is actually enforced, so the cases that
 * matter are the ones that decide whether a bad card exists at all, whether a
 * cancelled card can be revived, and whether the full number ever escapes a
 * second time.
 *
 * Both handlers are plain functions of a NextRequest over the in-memory store,
 * so they need no DOM and no running server.
 */

const VALID = {
  nickname: "Vendor subscription",
  merchantId: "mch_01",
  spendLimit: 25_000,
  currency: "USD",
  categoryLock: "any",
}

function post(body: unknown, headers: Record<string, string> = {}) {
  return POST(
    new NextRequest("http://localhost/api/cards", {
      method: "POST",
      headers: { "content-type": "application/json", ...headers },
      body: JSON.stringify(body),
    }),
  )
}

function patch(id: string, body: unknown) {
  return PATCH(
    new NextRequest(`http://localhost/api/cards/${id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    }),
    { params: Promise.resolve({ id }) },
  )
}

/** Issue a card and return its record, failing loudly if the route refused. */
async function issue(overrides: Record<string, unknown> = {}) {
  const response = await post({ ...VALID, ...overrides })
  expect(response.status).toBe(201)
  return response.json()
}

describe("POST /api/cards — validation", () => {
  const rejected: [string, Record<string, unknown>][] = [
    ["a missing merchant", { merchantId: "" }],
    ["an unknown merchant", { merchantId: "mch_nope" }],
    ["a zero limit", { spendLimit: 0 }],
    ["a negative limit", { spendLimit: -500 }],
    ["a limit above the ceiling", { spendLimit: 5_000_001 }],
    ["a non-integer limit", { spendLimit: 250.5 }],
    ["a limit sent as a string", { spendLimit: "25000" }],
    ["a currency outside the allowlist", { currency: "JPY" }],
    ["a blank nickname", { nickname: "   " }],
    ["an unknown category lock", { categoryLock: "weapons" }],
  ]

  it.each(rejected)("rejects %s with 400 and a message", async (_, patchBody) => {
    const response = await post({ ...VALID, ...patchBody })
    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toHaveProperty("message")
  })

  it("accepts the ceiling itself, so the bound is inclusive", async () => {
    const response = await post({ ...VALID, spendLimit: 5_000_000 })
    expect(response.status).toBe(201)
  })

  it("refuses a currency the merchant does not settle in", async () => {
    // mch_01 settles in USD, so a GBP card for them is the wrong-currency
    // mistake the ticket opens with — refused on the server, not just the form.
    const response = await post({ ...VALID, currency: "GBP" })
    expect(response.status).toBe(400)
    const body = await response.json()
    expect(body.message).toContain("USD")
  })

  it("rejects a body that is not JSON at all", async () => {
    const response = await POST(
      new NextRequest("http://localhost/api/cards", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: "not json",
      }),
    )
    expect(response.status).toBe(400)
  })
})

describe("POST /api/cards — the issued card", () => {
  it("returns a full number on the 4242 BIN with a valid Luhn digit", async () => {
    const { cardNumber } = await issue({ nickname: "Luhn check" })
    expect(cardNumber.startsWith("4242")).toBe(true)
    expect(cardNumber).toHaveLength(16)
    expect(isValidLuhn(cardNumber)).toBe(true)
  })

  it("stores only the last four, never the number", async () => {
    const { card, cardNumber } = await issue({ nickname: "Masking" })
    expect(card.last4).toBe(cardNumber.slice(-4))
    expect(JSON.stringify(card)).not.toContain(cardNumber)
  })

  it("starts the card active, with an issue event in its history", async () => {
    const { card } = await issue({ nickname: "History start" })
    expect(card.status).toBe("active")
    expect(card.history).toEqual([
      { from: null, to: "active", at: expect.any(String) },
    ])
  })
})

describe("GET /api/cards", () => {
  it("never carries a full card number", async () => {
    await issue({ nickname: "Leak check" })
    const body = await (await GET()).text()
    expect(body).not.toMatch(/\b4242\d{12}\b/)
  })

  it("returns records whose only card digits are the last four", async () => {
    const { cards } = await (await GET()).json()
    for (const card of cards) {
      expect(Object.keys(card)).not.toContain("cardNumber")
      expect(card.last4).toMatch(/^\d{4}$/)
    }
  })
})

describe("POST /api/cards — idempotency", () => {
  it("does not mint a second card for a repeated key", async () => {
    const key = "issue-key-repeat"
    const first = await post({ ...VALID, nickname: "Once only" }, { "idempotency-key": key })
    const second = await post({ ...VALID, nickname: "Once only" }, { "idempotency-key": key })

    expect(first.status).toBe(201)
    expect(second.status).toBe(200)

    const a = await first.json()
    const b = await second.json()
    expect(b.card.id).toBe(a.card.id)
    expect(b.replayed).toBe(true)
  })

  it("does not reveal the number a second time on a replay", async () => {
    const key = "issue-key-reveal"
    await post({ ...VALID, nickname: "Reveal once" }, { "idempotency-key": key })
    const replay = await post(
      { ...VALID, nickname: "Reveal once" },
      { "idempotency-key": key },
    )
    const body = await replay.json()
    expect(body.cardNumber).toBeUndefined()
  })

  it("still issues separately for different keys", async () => {
    const a = await (
      await post({ ...VALID, nickname: "Key A" }, { "idempotency-key": "key-a" })
    ).json()
    const b = await (
      await post({ ...VALID, nickname: "Key B" }, { "idempotency-key": "key-b" })
    ).json()
    expect(a.card.id).not.toBe(b.card.id)
  })
})

describe("PATCH /api/cards/[id] — the status machine", () => {
  it("moves active to frozen and back", async () => {
    const { card } = await issue({ nickname: "Freeze me" })

    const frozen = await patch(card.id, { status: "frozen" })
    expect(frozen.status).toBe(200)
    expect((await frozen.json()).card.status).toBe("frozen")

    const active = await patch(card.id, { status: "active" })
    expect(active.status).toBe(200)
    expect((await active.json()).card.status).toBe("active")
  })

  it("refuses a move to the status the card is already in", async () => {
    const { card } = await issue({ nickname: "No-op move" })
    const response = await patch(card.id, { status: "active" })
    expect(response.status).toBe(409)
  })

  it("treats cancelled as terminal, from every direction", async () => {
    const { card } = await issue({ nickname: "Terminal" })
    expect((await patch(card.id, { status: "cancelled" })).status).toBe(200)

    for (const status of ["active", "frozen", "cancelled"]) {
      const response = await patch(card.id, { status })
      expect(response.status).toBe(409)
      expect((await response.json()).message).toContain("cancelled")
    }
  })

  it("records every transition in the card's history", async () => {
    const { card } = await issue({ nickname: "Audit trail" })
    await patch(card.id, { status: "frozen" })
    const updated = await (await patch(card.id, { status: "active" })).json()

    expect(updated.card.history.map((e: { to: string }) => e.to)).toEqual([
      "active",
      "frozen",
      "active",
    ])
  })

  it("rejects a status that is not a card status", async () => {
    const { card } = await issue({ nickname: "Bad status" })
    const response = await patch(card.id, { status: "expired" })
    expect(response.status).toBe(400)
  })

  it("returns 404 for a card that does not exist", async () => {
    const response = await patch("card_missing", { status: "frozen" })
    expect(response.status).toBe(404)
  })
})
