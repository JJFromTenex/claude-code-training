import { describe, expect, it } from "vitest"
import { isValidLuhn } from "@/lib/cardNumber"
import { merchants } from "./merchants"
import { createCard, parseIssueCardInput, updateCardStatus } from "./cardQueries"

const validInput = () => ({
  nickname: "Ad spend — Meta",
  merchantId: merchants[0].id,
  limit: 25000,
  currency: "USD",
})

describe("parseIssueCardInput", () => {
  it("accepts a fully valid body", () => {
    const result = parseIssueCardInput(validInput())
    expect(result.ok).toBe(true)
  })

  it("rejects a missing merchant", () => {
    const result = parseIssueCardInput({ ...validInput(), merchantId: undefined })
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.fields.merchantId).toBeDefined()
  })

  it("rejects an unknown merchant id", () => {
    const result = parseIssueCardInput({ ...validInput(), merchantId: "mch_does_not_exist" })
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.fields.merchantId).toBeDefined()
  })

  it("rejects a zero limit", () => {
    const result = parseIssueCardInput({ ...validInput(), limit: 0 })
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.fields.limit).toBeDefined()
  })

  it("rejects a negative limit", () => {
    const result = parseIssueCardInput({ ...validInput(), limit: -100 })
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.fields.limit).toBeDefined()
  })

  it("rejects a limit above 5,000,000 minor units", () => {
    const result = parseIssueCardInput({ ...validInput(), limit: 5_000_001 })
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.fields.limit).toBeDefined()
  })

  it("accepts a limit of exactly 5,000,000 minor units", () => {
    const result = parseIssueCardInput({ ...validInput(), limit: 5_000_000 })
    expect(result.ok).toBe(true)
  })

  it("rejects a currency outside USD/EUR/GBP", () => {
    const result = parseIssueCardInput({ ...validInput(), currency: "JPY" })
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.fields.currency).toBeDefined()
  })

  it("rejects a missing nickname", () => {
    const result = parseIssueCardInput({ ...validInput(), nickname: "" })
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.fields.nickname).toBeDefined()
  })

  it("rejects an invalid category", () => {
    const result = parseIssueCardInput({ ...validInput(), category: "not_a_real_category" })
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.fields.category).toBeDefined()
  })

  it("accepts a valid category", () => {
    const result = parseIssueCardInput({ ...validInput(), category: "advertising" })
    expect(result.ok).toBe(true)
  })
})

describe("createCard", () => {
  it("returns a card with only last4 and a full number that starts 4242 and passes Luhn", () => {
    const parsed = parseIssueCardInput(validInput())
    if (!parsed.ok) throw new Error("expected valid input")

    const { card, number } = createCard(parsed.value)

    expect(number.startsWith("4242")).toBe(true)
    expect(isValidLuhn(number)).toBe(true)
    expect(card.last4).toBe(number.slice(-4))
    expect(card).not.toHaveProperty("number")
    expect(card.status).toBe("active")
  })
})

describe("updateCardStatus", () => {
  function issueCard() {
    const parsed = parseIssueCardInput(validInput())
    if (!parsed.ok) throw new Error("expected valid input")
    return createCard(parsed.value).card
  }

  it("allows active to frozen and back to active", () => {
    const card = issueCard()
    expect(updateCardStatus(card.id, "frozen").ok).toBe(true)
    expect(updateCardStatus(card.id, "active").ok).toBe(true)
  })

  it("allows active to cancelled", () => {
    const card = issueCard()
    expect(updateCardStatus(card.id, "cancelled").ok).toBe(true)
  })

  it("allows frozen to cancelled", () => {
    const card = issueCard()
    updateCardStatus(card.id, "frozen")
    expect(updateCardStatus(card.id, "cancelled").ok).toBe(true)
  })

  it("rejects any transition out of cancelled", () => {
    const card = issueCard()
    updateCardStatus(card.id, "cancelled")

    const toActive = updateCardStatus(card.id, "active")
    const toFrozen = updateCardStatus(card.id, "frozen")

    expect(toActive.ok).toBe(false)
    expect(toFrozen.ok).toBe(false)
  })

  it("returns an error for a card that does not exist", () => {
    const result = updateCardStatus("card_does_not_exist", "frozen")
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error).toBe("Card not found.")
  })
})
