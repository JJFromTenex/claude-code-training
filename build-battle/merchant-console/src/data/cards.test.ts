import { describe, expect, it } from "vitest"
import { IssueCardInput, issueCard, transitionCard, validateIssueCard } from "./cards"

const GOOD: IssueCardInput = {
  nickname: "Ads",
  merchantId: "mch_01", // Lumen Coffee Roasters, USD
  spendLimit: 25000,
  currency: "USD",
  category: "advertising",
}

describe("validateIssueCard", () => {
  it("accepts a well-formed request", () => {
    expect(validateIssueCard(GOOD)).toEqual({ input: GOOD })
  })

  it.each([
    ["missing merchant", { merchantId: "" }, "merchantId"],
    ["unknown merchant", { merchantId: "mch_99" }, "merchantId"],
    ["zero limit", { spendLimit: 0 }, "spendLimit"],
    ["negative limit", { spendLimit: -1 }, "spendLimit"],
    ["limit above 5,000,000", { spendLimit: 5_000_001 }, "spendLimit"],
    ["fractional limit", { spendLimit: 250.5 }, "spendLimit"],
    ["limit as a string", { spendLimit: "$250.00" }, "spendLimit"],
    ["currency outside the allowlist", { currency: "JPY" }, "currency"],
    ["currency that is not the merchant's", { currency: "GBP" }, "currency"],
    ["empty nickname", { nickname: "  " }, "nickname"],
    ["unknown category", { category: "gambling" }, "category"],
  ])("rejects a %s", (_, patch, field) => {
    const result = validateIssueCard({ ...GOOD, ...patch })
    expect(result.errors).toHaveProperty(field)
  })

})

describe("issueCard", () => {
  it("returns the number once and never stores it", () => {
    const { card, cardNumber, replayed } = issueCard(GOOD)
    expect(replayed).toBe(false)
    expect(cardNumber).toMatch(/^4242\d{12}$/)
    expect(card.last4).toBe(cardNumber!.slice(-4))
    expect(card.spent).toBe(0)
    expect(card.status).toBe("active")
    expect(JSON.stringify(card)).not.toMatch(/\d{16}/)
  })

  it("replays an idempotency key without issuing again or re-revealing", () => {
    const first = issueCard(GOOD, "key-1")
    const second = issueCard(GOOD, "key-1")
    expect(second.card.id).toBe(first.card.id)
    expect(second.replayed).toBe(true)
    expect(second.cardNumber).toBeUndefined()
  })
})

describe("transitionCard", () => {
  it("walks active → frozen → active → cancelled and then refuses everything", () => {
    const { card } = issueCard(GOOD)
    expect(transitionCard(card, "frozen")).toEqual({ card })
    expect(transitionCard(card, "active")).toEqual({ card })
    expect(transitionCard(card, "cancelled")).toEqual({ card })
    expect(transitionCard(card, "active")).toEqual({ error: "A cancelled card cannot be changed." })
    expect(card.events.map((e) => e.type)).toEqual([
      "issued",
      "frozen",
      "unfrozen",
      "cancelled",
    ])
  })
})
