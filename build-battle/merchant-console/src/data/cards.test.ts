import { isValidLuhn } from "@/lib/cards"
import { describe, expect, it } from "vitest"
import {
  MAX_SPEND_LIMIT,
  cardById,
  createCard,
  parseCreateCard,
  transitionCard,
} from "./cards"
import { merchants } from "./merchants"

// merchants[0] settles in USD; the valid body matches it on purpose.
const valid = {
  nickname: "Ad spend",
  merchantId: merchants[0].id,
  spendLimit: 25000,
  currency: merchants[0].currency,
}

const issue = (overrides: Partial<Parameters<typeof createCard>[0]> = {}) =>
  createCard({
    nickname: "Test card",
    merchantId: merchants[0].id,
    spendLimit: 10000,
    currency: merchants[0].currency,
    categoryLock: null,
    idempotencyKey: null,
    ...overrides,
  })

describe("parseCreateCard", () => {
  it("accepts a valid body and trims the nickname", () => {
    const result = parseCreateCard({ ...valid, nickname: "  Ad spend  " })
    expect(result).toEqual({
      ok: true,
      input: {
        nickname: "Ad spend",
        merchantId: merchants[0].id,
        spendLimit: 25000,
        currency: merchants[0].currency,
        categoryLock: null,
        idempotencyKey: null,
      },
    })
  })

  it("accepts a limit of exactly the maximum", () => {
    const result = parseCreateCard({ ...valid, spendLimit: MAX_SPEND_LIMIT })
    expect(result.ok).toBe(true)
  })

  it("accepts an allowlisted category lock and treats empty as none", () => {
    const locked = parseCreateCard({ ...valid, categoryLock: "advertising" })
    expect(locked.ok && locked.input.categoryLock).toBe("advertising")
    const none = parseCreateCard({ ...valid, categoryLock: "" })
    expect(none.ok && none.input.categoryLock).toBe(null)
  })

  it("rejects a currency that does not match the merchant's", () => {
    // GBP is in the allowlist, but merchants[0] settles in USD.
    const result = parseCreateCard({ ...valid, currency: "GBP" })
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error).toContain("settlement currency")
  })

  it.each([
    ["a non-object body", "not json"],
    ["a missing nickname", { ...valid, nickname: "" }],
    ["a missing merchant", { ...valid, merchantId: undefined }],
    ["an unknown merchant", { ...valid, merchantId: "mch_9999" }],
    ["a string limit", { ...valid, spendLimit: "25000" }],
    ["a float limit", { ...valid, spendLimit: 250.5 }],
    ["a zero limit", { ...valid, spendLimit: 0 }],
    ["a negative limit", { ...valid, spendLimit: -100 }],
    ["a limit over the maximum", { ...valid, spendLimit: MAX_SPEND_LIMIT + 1 }],
    ["a currency outside the allowlist", { ...valid, currency: "JPY" }],
    ["an unknown category lock", { ...valid, categoryLock: "gambling" }],
    ["an oversized idempotency key", { ...valid, idempotencyKey: "x".repeat(129) }],
  ])("rejects %s", (_label, body) => {
    const result = parseCreateCard(body)
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error).toBeTruthy()
  })
})

describe("createCard", () => {
  it("stores last4 and a reference, never the full number", () => {
    const result = issue({ nickname: "Stored fields" })
    if (result.replayed) throw new Error("fresh create reported as replay")
    const { card, number } = result
    expect(number.startsWith("4242")).toBe(true)
    expect(isValidLuhn(number)).toBe(true)
    expect(card.last4).toBe(number.slice(-4))
    expect(Object.values(card)).not.toContain(number)
    expect(card.status).toBe("active")
    expect(card.spent).toBe(0)
    expect(card.history).toEqual([{ at: card.createdAt, event: "issued" }])
    expect(cardById(card.id)).toBe(card)
  })

  it("replays a repeated idempotency key without issuing again or re-revealing", () => {
    const key = "test-idem-key-1"
    const first = issue({ idempotencyKey: key })
    if (first.replayed) throw new Error("fresh create reported as replay")
    const second = issue({ idempotencyKey: key })
    expect(second.replayed).toBe(true)
    expect(second.card).toBe(first.card)
    expect("number" in second).toBe(false)
  })
})

describe("transitionCard", () => {
  const issued = () => {
    const result = issue({ nickname: "Transitions" })
    if (result.replayed) throw new Error("fresh create reported as replay")
    return result.card
  }

  it("walks active → frozen → active and records history", () => {
    const card = issued()
    expect(transitionCard(card.id, "frozen")).toEqual({ ok: true, card })
    expect(card.status).toBe("frozen")
    expect(transitionCard(card.id, "active")).toEqual({ ok: true, card })
    expect(card.status).toBe("active")
    expect(card.history.map((h) => h.event)).toEqual([
      "issued",
      "frozen",
      "unfrozen",
    ])
  })

  it("treats cancelled as terminal with a 409", () => {
    const card = issued()
    expect(transitionCard(card.id, "cancelled").ok).toBe(true)
    const revived = transitionCard(card.id, "active")
    expect(revived).toMatchObject({ ok: false, status: 409 })
    expect(card.status).toBe("cancelled")
  })

  it("rejects a status outside the allowlist with a 400", () => {
    const card = issued()
    expect(transitionCard(card.id, "melted")).toMatchObject({
      ok: false,
      status: 400,
    })
  })

  it("returns 404 for an unknown card", () => {
    expect(transitionCard("card_nope", "frozen")).toMatchObject({
      ok: false,
      status: 404,
    })
  })
})
