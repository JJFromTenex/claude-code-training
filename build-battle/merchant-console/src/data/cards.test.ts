import { beforeEach, describe, expect, it } from "vitest"
import { store } from "./store"
import { createCard, cardSpend, transitionCard, validateIssueInput } from "./cards"

beforeEach(() => {
  store.cards.length = 0
  store.issuedKeys.clear()
})

describe("validateIssueInput", () => {
  const valid = {
    nickname: "Ad spend",
    merchantId: "mch_01",
    spendLimit: 25000,
    currency: "USD",
  }

  it("accepts valid input", () => {
    expect(validateIssueInput(valid)).toBeNull()
  })

  it("rejects a blank nickname", () => {
    expect(validateIssueInput({ ...valid, nickname: "" })).toEqual({
      message: "Nickname is required.",
    })
  })

  it("rejects a missing nickname", () => {
    expect(validateIssueInput({ ...valid, nickname: undefined })).toEqual({
      message: "Nickname is required.",
    })
  })

  it("rejects a missing merchant", () => {
    expect(validateIssueInput({ ...valid, merchantId: "" })).toEqual({
      message: "Merchant is required.",
    })
  })

  it("rejects an unknown merchant", () => {
    expect(validateIssueInput({ ...valid, merchantId: "mch_99" })).toEqual({
      message: "Unknown merchant mch_99.",
    })
  })

  it("rejects a zero limit", () => {
    expect(validateIssueInput({ ...valid, spendLimit: 0 })).toEqual({
      message: "Spend limit must be greater than zero.",
    })
  })

  it("rejects a negative limit", () => {
    expect(validateIssueInput({ ...valid, spendLimit: -100 })).toEqual({
      message: "Spend limit must be greater than zero.",
    })
  })

  it("rejects a limit over the maximum", () => {
    expect(validateIssueInput({ ...valid, spendLimit: 5_000_001 })).toEqual({
      message: "Spend limit exceeds the maximum.",
    })
  })

  it("accepts a limit exactly at the maximum", () => {
    expect(validateIssueInput({ ...valid, spendLimit: 5_000_000 })).toBeNull()
  })

  it("rejects a non-integer limit", () => {
    expect(validateIssueInput({ ...valid, spendLimit: 250.5 })).toEqual({
      message: "Spend limit must be a whole number of cents.",
    })
  })

  it("rejects a string limit", () => {
    expect(validateIssueInput({ ...valid, spendLimit: "250" as unknown as number })).toEqual({
      message: "Spend limit must be a number.",
    })
  })

  it("rejects an invalid currency", () => {
    expect(validateIssueInput({ ...valid, currency: "JPY" })).toEqual({
      message: "Unsupported currency JPY.",
    })
  })

  it("rejects a currency that does not match the merchant", () => {
    expect(validateIssueInput({ ...valid, currency: "GBP" })).toEqual({
      message: "Currency GBP does not match merchant Lumen Coffee Roasters (USD).",
    })
  })

  it("rejects an unknown category", () => {
    expect(validateIssueInput({ ...valid, category: "crypto" })).toEqual({
      message: "Unsupported category crypto.",
    })
  })

  it("accepts a valid category", () => {
    expect(validateIssueInput({ ...valid, category: "advertising" })).toBeNull()
  })

  it("accepts null category", () => {
    expect(validateIssueInput({ ...valid, category: null })).toBeNull()
  })
})

describe("createCard", () => {
  it("creates a card with sequential ids", () => {
    const r1 = createCard({
      nickname: "Card A",
      merchantId: "mch_01",
      spendLimit: 10000,
      currency: "USD",
      category: null,
    })
    const r2 = createCard({
      nickname: "Card B",
      merchantId: "mch_01",
      spendLimit: 20000,
      currency: "USD",
      category: null,
    })
    expect(r1.card.id).not.toBe(r2.card.id)
    expect(store.cards).toHaveLength(2)
  })

  it("returns the full number only on creation", () => {
    const { card, fullNumber } = createCard({
      nickname: "Test",
      merchantId: "mch_01",
      spendLimit: 10000,
      currency: "USD",
      category: null,
    })
    expect(fullNumber).toHaveLength(16)
    expect(fullNumber.startsWith("4242")).toBe(true)
    expect(card.last4).toBe(fullNumber.slice(-4))
    expect(JSON.stringify(card)).not.toContain(fullNumber)
  })

  it("honors idempotency keys", () => {
    const r1 = createCard({
      nickname: "Test",
      merchantId: "mch_01",
      spendLimit: 10000,
      currency: "USD",
      category: null,
      idempotencyKey: "key-1",
    })
    const r2 = createCard({
      nickname: "Test",
      merchantId: "mch_01",
      spendLimit: 10000,
      currency: "USD",
      category: null,
      idempotencyKey: "key-1",
    })
    expect(r1.card.id).toBe(r2.card.id)
    expect(r2.fullNumber).toBe("")
    expect(store.cards).toHaveLength(1)
  })

  it("starts with active status", () => {
    const { card } = createCard({
      nickname: "Test",
      merchantId: "mch_01",
      spendLimit: 10000,
      currency: "USD",
      category: null,
    })
    expect(card.status).toBe("active")
  })
})

describe("transitionCard", () => {
  it("transitions active to frozen", () => {
    const { card } = createCard({
      nickname: "Test",
      merchantId: "mch_01",
      spendLimit: 10000,
      currency: "USD",
      category: null,
    })
    const result = transitionCard(card.id, "frozen")
    expect("card" in result).toBe(true)
    if ("card" in result) {
      expect(result.card.status).toBe("frozen")
      expect(result.card.history).toHaveLength(1)
      expect(result.card.history[0].from).toBe("active")
      expect(result.card.history[0].to).toBe("frozen")
    }
  })

  it("transitions frozen back to active", () => {
    const { card } = createCard({
      nickname: "Test",
      merchantId: "mch_01",
      spendLimit: 10000,
      currency: "USD",
      category: null,
    })
    transitionCard(card.id, "frozen")
    const result = transitionCard(card.id, "active")
    expect("card" in result).toBe(true)
    if ("card" in result) expect(result.card.status).toBe("active")
  })

  it("rejects cancelled to active with 409", () => {
    const { card } = createCard({
      nickname: "Test",
      merchantId: "mch_01",
      spendLimit: 10000,
      currency: "USD",
      category: null,
    })
    transitionCard(card.id, "cancelled")
    const result = transitionCard(card.id, "active")
    expect("error" in result).toBe(true)
    if ("error" in result) expect(result.status).toBe(409)
  })

  it("rejects cancelled to frozen with 409", () => {
    const { card } = createCard({
      nickname: "Test",
      merchantId: "mch_01",
      spendLimit: 10000,
      currency: "USD",
      category: null,
    })
    transitionCard(card.id, "cancelled")
    const result = transitionCard(card.id, "frozen")
    expect("error" in result).toBe(true)
    if ("error" in result) expect(result.status).toBe(409)
  })

  it("rejects frozen to frozen with 409", () => {
    const { card } = createCard({
      nickname: "Test",
      merchantId: "mch_01",
      spendLimit: 10000,
      currency: "USD",
      category: null,
    })
    transitionCard(card.id, "frozen")
    const result = transitionCard(card.id, "frozen")
    expect("error" in result).toBe(true)
    if ("error" in result) expect(result.status).toBe(409)
  })

  it("returns 404 for an unknown card", () => {
    const result = transitionCard("card_9999", "frozen")
    expect("error" in result).toBe(true)
    if ("error" in result) expect(result.status).toBe(404)
  })

  it("records history on each transition", () => {
    const { card } = createCard({
      nickname: "Test",
      merchantId: "mch_01",
      spendLimit: 10000,
      currency: "USD",
      category: null,
    })
    transitionCard(card.id, "frozen")
    transitionCard(card.id, "active")
    transitionCard(card.id, "cancelled")
    expect(card.history).toHaveLength(3)
    expect(card.history[2].from).toBe("active")
    expect(card.history[2].to).toBe("cancelled")
  })
})

describe("cardSpend", () => {
  it("returns zero for a brand new card", () => {
    const { card } = createCard({
      nickname: "Test",
      merchantId: "mch_01",
      spendLimit: 10000,
      currency: "USD",
      category: null,
    })
    expect(cardSpend(card)).toBe(0)
  })
})
