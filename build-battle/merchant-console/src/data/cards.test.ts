import { beforeEach, describe, expect, it } from "vitest"
import { merchants } from "./merchants"
import { store } from "./store"
import { canTransition, createCard, parseCardInput, setCardStatus } from "./cards"

/**
 * Cards are created and mutated server-side only. These tests pin the
 * validation allowlist and the status state machine — the two places a
 * client input can otherwise corrupt a card.
 */

beforeEach(() => {
  store.cards.length = 0
})

const validInput = {
  nickname: "Ad spend — Q3",
  merchantId: merchants[0].id,
  limit: 50000,
  currency: "USD",
  category: null,
}

describe("parseCardInput", () => {
  it("accepts a fully valid request", () => {
    const { data, errors } = parseCardInput(validInput)
    expect(errors).toEqual({})
    expect(data).toEqual(validInput)
  })

  it("rejects a missing merchant", () => {
    const { data, errors } = parseCardInput({ ...validInput, merchantId: "mch_missing" })
    expect(data).toBeNull()
    expect(errors.merchantId).toBeTruthy()
  })

  it("rejects a zero limit", () => {
    const { errors } = parseCardInput({ ...validInput, limit: 0 })
    expect(errors.limit).toBeTruthy()
  })

  it("rejects a negative limit", () => {
    const { errors } = parseCardInput({ ...validInput, limit: -500 })
    expect(errors.limit).toBeTruthy()
  })

  it("rejects a limit above 5,000,000 minor units", () => {
    const { errors } = parseCardInput({ ...validInput, limit: 5_000_001 })
    expect(errors.limit).toBeTruthy()
  })

  it("accepts a limit at exactly the 5,000,000 ceiling", () => {
    const { errors } = parseCardInput({ ...validInput, limit: 5_000_000 })
    expect(errors.limit).toBeUndefined()
  })

  it("rejects a currency outside USD, EUR, GBP", () => {
    const { errors } = parseCardInput({ ...validInput, currency: "JPY" })
    expect(errors.currency).toBeTruthy()
  })

  it("rejects a currency that doesn't match the merchant's own currency", () => {
    const gbpMerchant = merchants.find((m) => m.currency === "GBP")!
    const { data, errors } = parseCardInput({
      ...validInput,
      merchantId: gbpMerchant.id,
      currency: "USD",
    })
    expect(data).toBeNull()
    expect(errors.currency).toContain("GBP")
  })

  it("accepts a currency that matches a non-USD merchant", () => {
    const eurMerchant = merchants.find((m) => m.currency === "EUR")!
    const { errors } = parseCardInput({
      ...validInput,
      merchantId: eurMerchant.id,
      currency: "EUR",
    })
    expect(errors.currency).toBeUndefined()
  })

  it("never trusts a formatted limit string", () => {
    const { errors } = parseCardInput({ ...validInput, limit: "500.00" })
    expect(errors.limit).toBeTruthy()
  })
})

describe("createCard", () => {
  it("returns the full number once and stores only the last four", () => {
    const { data } = parseCardInput(validInput)
    const { card, number } = createCard(data!)
    expect(number).toHaveLength(16)
    expect(card.last4).toBe(number.slice(-4))
    expect(JSON.stringify(card)).not.toContain(number)
  })

  it("starts a new card active with zero spend", () => {
    const { data } = parseCardInput(validInput)
    const { card } = createCard(data!)
    expect(card.status).toBe("active")
    expect(card.spend).toBe(0)
  })
})

describe("status state machine", () => {
  it("allows active to frozen and back", () => {
    expect(canTransition("active", "frozen")).toBe(true)
    expect(canTransition("frozen", "active")).toBe(true)
  })

  it("allows active or frozen to cancelled", () => {
    expect(canTransition("active", "cancelled")).toBe(true)
    expect(canTransition("frozen", "cancelled")).toBe(true)
  })

  it("treats cancelled as terminal", () => {
    expect(canTransition("cancelled", "active")).toBe(false)
    expect(canTransition("cancelled", "frozen")).toBe(false)
  })

  it("rejects an illegal transition through setCardStatus without throwing", () => {
    const { data } = parseCardInput(validInput)
    const { card } = createCard(data!)
    setCardStatus(card.id, "cancelled")
    const result = setCardStatus(card.id, "active")
    expect(result).toBeNull()
    expect(card.status).toBe("cancelled")
  })

  it("returns null for an unknown card id", () => {
    expect(setCardStatus("card_missing", "frozen")).toBeNull()
  })
})
