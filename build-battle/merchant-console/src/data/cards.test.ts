import { describe, expect, it } from "vitest"
import { issueCard, setCardStatus, SPEND_LIMIT_MAX_MINOR_UNITS } from "./cards"

const validInput = {
  nickname: "Test card",
  merchantId: "mch_01", // USD merchant, per src/data/merchants.ts
  limit: "500.00",
  currency: "USD",
  category: "vendor_subscriptions",
}

describe("issueCard", () => {
  it("rejects a missing nickname", () => {
    const result = issueCard({ ...validInput, nickname: "" })
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error).toMatch(/nickname/i)
  })

  it("rejects a missing or unknown merchant", () => {
    const result = issueCard({ ...validInput, merchantId: "mch_does_not_exist" })
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error).toMatch(/merchant/i)
  })

  it("rejects a zero spend limit", () => {
    const result = issueCard({ ...validInput, limit: "0" })
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error).toMatch(/greater than/i)
  })

  it("rejects a negative spend limit", () => {
    const result = issueCard({ ...validInput, limit: "-100" })
    expect(result.ok).toBe(false)
  })

  it("rejects a spend limit above 5,000,000 minor units", () => {
    const result = issueCard({ ...validInput, limit: "50000.01" })
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error).toMatch(/5,000,000/)
  })

  it("accepts a spend limit at exactly the 5,000,000 boundary", () => {
    const result = issueCard({ ...validInput, limit: "50000.00" })
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.card.limit).toBe(SPEND_LIMIT_MAX_MINOR_UNITS)
  })

  it("rejects a currency outside USD/EUR/GBP", () => {
    const result = issueCard({ ...validInput, currency: "JPY" })
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error).toMatch(/USD, EUR, or GBP/)
  })

  it("rejects a currency that doesn't match the merchant's own currency", () => {
    // mch_01 (Lumen Coffee Roasters) settles in USD, not EUR.
    const result = issueCard({ ...validInput, currency: "EUR" })
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error).toMatch(/settles in USD/)
  })

  it("rejects an unrecognized category", () => {
    const result = issueCard({ ...validInput, category: "yacht_fuel" })
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error).toMatch(/category/i)
  })

  it("issues a card with the reveal-once number and a masked record", () => {
    const result = issueCard(validInput)
    expect(result.ok).toBe(true)
    if (!result.ok) return

    expect(result.number).toMatch(/^4242\d{12}$/)
    expect(result.card.last4).toBe(result.number.slice(-4))
    expect(result.card).not.toHaveProperty("number")
    expect(result.card.status).toBe("active")
    expect(result.card.spent).toBe(0)
    expect(result.card.currency).toBe("USD")
    expect(result.card.history).toEqual([
      { status: "active", at: result.card.createdAt },
    ])
  })
})

describe("setCardStatus", () => {
  it("returns 404 for a card that does not exist", () => {
    const result = setCardStatus("card_does_not_exist", "frozen")
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.status).toBe(404)
  })

  it("allows active -> frozen -> active and records both transitions", () => {
    const issued = issueCard(validInput)
    if (!issued.ok) throw new Error("setup failed")
    const id = issued.card.id

    const frozen = setCardStatus(id, "frozen")
    expect(frozen.ok).toBe(true)
    if (frozen.ok) expect(frozen.card.status).toBe("frozen")

    const active = setCardStatus(id, "active")
    expect(active.ok).toBe(true)
    if (active.ok) {
      expect(active.card.status).toBe("active")
      expect(active.card.history.map((h) => h.status)).toEqual([
        "active",
        "frozen",
        "active",
      ])
    }
  })

  it("refuses to move a cancelled card anywhere", () => {
    const issued = issueCard(validInput)
    if (!issued.ok) throw new Error("setup failed")
    const id = issued.card.id

    const cancelled = setCardStatus(id, "cancelled")
    expect(cancelled.ok).toBe(true)

    const revive = setCardStatus(id, "active")
    expect(revive.ok).toBe(false)
    if (!revive.ok) {
      expect(revive.status).toBe(400)
      expect(revive.error).toMatch(/cancelled/)
    }
  })
})
