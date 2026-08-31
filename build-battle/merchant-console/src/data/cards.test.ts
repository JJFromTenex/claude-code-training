import { beforeEach, describe, expect, it } from "vitest"
import { store } from "./store"
import {
  cardById,
  isCardStatus,
  isMerchantCategory,
  issueCard,
  listCards,
  transitionCardStatus,
  validateIssueCardInput,
} from "./cards"

/**
 * The four rejections and the state machine are the two things a bad request
 * or a bad transition could turn into a shippable-looking but wrong card, so
 * they get the most direct coverage.
 */

const VALID_INPUT = {
  nickname: "Ad spend",
  merchantId: "mch_01",
  limit: 25000,
  currency: "USD",
}

beforeEach(() => {
  store.cards.length = 0
})

describe("validateIssueCardInput", () => {
  it("accepts a well-formed request", () => {
    const result = validateIssueCardInput(VALID_INPUT)
    expect(result.ok).toBe(true)
  })

  it("rejects a missing or unresolvable merchant", () => {
    expect(
      validateIssueCardInput({ ...VALID_INPUT, merchantId: "" }).ok,
    ).toBe(false)
    expect(
      validateIssueCardInput({ ...VALID_INPUT, merchantId: "mch_99" }).ok,
    ).toBe(false)
  })

  it("rejects a zero or negative limit", () => {
    expect(validateIssueCardInput({ ...VALID_INPUT, limit: 0 }).ok).toBe(
      false,
    )
    expect(validateIssueCardInput({ ...VALID_INPUT, limit: -100 }).ok).toBe(
      false,
    )
  })

  it("rejects a limit above 5,000,000 minor units", () => {
    expect(
      validateIssueCardInput({ ...VALID_INPUT, limit: 5_000_001 }).ok,
    ).toBe(false)
    expect(
      validateIssueCardInput({ ...VALID_INPUT, limit: 5_000_000 }).ok,
    ).toBe(true)
  })

  it("rejects a currency outside USD, EUR, GBP", () => {
    expect(
      validateIssueCardInput({ ...VALID_INPUT, currency: "JPY" }).ok,
    ).toBe(false)
  })

  it("treats category as optional, defaulting to null", () => {
    const result = validateIssueCardInput(VALID_INPUT)
    expect(result.ok && result.value.category).toBeNull()
  })

  it("accepts a valid category and rejects an unknown one", () => {
    expect(
      validateIssueCardInput({ ...VALID_INPUT, category: "travel" }).ok,
    ).toBe(true)
    expect(
      validateIssueCardInput({ ...VALID_INPUT, category: "yachts" }).ok,
    ).toBe(false)
  })
})

describe("issueCard", () => {
  it("returns the full number once and stores only the last four", () => {
    const result = issueCard(VALID_INPUT)
    if (!result.ok) throw new Error("expected issueCard to succeed")

    expect(result.fullNumber).toHaveLength(16)
    expect(result.fullNumber.startsWith("4242")).toBe(true)
    expect(result.card.last4).toBe(result.fullNumber.slice(-4))
    expect(result.card).not.toHaveProperty("fullNumber")
    expect(result.card).not.toHaveProperty("number")
  })

  it("starts a new card as active with zero spend", () => {
    const result = issueCard(VALID_INPUT)
    if (!result.ok) throw new Error("expected issueCard to succeed")

    expect(result.card.status).toBe("active")
    expect(result.card.spent).toBe(0)
  })

  it("adds the card to listCards and cardById", () => {
    const result = issueCard(VALID_INPUT)
    if (!result.ok) throw new Error("expected issueCard to succeed")

    expect(listCards()).toHaveLength(1)
    expect(cardById(result.card.id)).toEqual(result.card)
  })
})

describe("transitionCardStatus", () => {
  it("allows active to frozen to active to cancelled", () => {
    const { card } = issueCard(VALID_INPUT) as { card: { id: string } }

    expect(transitionCardStatus(card.id, "frozen").ok).toBe(true)
    expect(transitionCardStatus(card.id, "active").ok).toBe(true)
    expect(transitionCardStatus(card.id, "cancelled").ok).toBe(true)
  })

  it("treats cancelled as terminal", () => {
    const { card } = issueCard(VALID_INPUT) as { card: { id: string } }
    transitionCardStatus(card.id, "cancelled")

    expect(transitionCardStatus(card.id, "active").ok).toBe(false)
    expect(transitionCardStatus(card.id, "frozen").ok).toBe(false)
  })

  it("rejects a same-state transition rather than treating it as a no-op", () => {
    const { card } = issueCard(VALID_INPUT) as { card: { id: string } }
    expect(transitionCardStatus(card.id, "active").ok).toBe(false)
  })

  it("rejects a transition on a card that doesn't exist", () => {
    const result = transitionCardStatus("card_999999", "frozen")
    expect(result.ok).toBe(false)
  })
})

describe("isCardStatus", () => {
  it("accepts the three known statuses and rejects anything else", () => {
    expect(isCardStatus("active")).toBe(true)
    expect(isCardStatus("frozen")).toBe(true)
    expect(isCardStatus("cancelled")).toBe(true)
    expect(isCardStatus("closed")).toBe(false)
    expect(isCardStatus(undefined)).toBe(false)
  })
})

describe("isMerchantCategory", () => {
  it("accepts a known category and rejects anything else", () => {
    expect(isMerchantCategory("software")).toBe(true)
    expect(isMerchantCategory("yachts")).toBe(false)
    expect(isMerchantCategory(null)).toBe(false)
  })
})
