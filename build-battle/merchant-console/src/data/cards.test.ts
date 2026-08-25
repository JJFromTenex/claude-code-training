import { beforeEach, describe, expect, it } from "vitest"
import { store } from "./store"
import {
  canTransition,
  issueCard,
  issueCardIdempotent,
  MAX_SPEND_LIMIT,
  transitionCard,
  validateIssueCard,
} from "./cards"

const VALID = {
  nickname: "Ad spend",
  merchantId: "mch_01",
  spendLimit: 25_000,
  currency: "USD" as const,
  category: "advertising" as const,
}

beforeEach(() => {
  store.cards = []
})

describe("validateIssueCard", () => {
  it("accepts a valid input", () => {
    expect(validateIssueCard(VALID)).toEqual([])
  })

  it("rejects a missing merchant", () => {
    expect(validateIssueCard({ ...VALID, merchantId: "" })).toContain(
      "A valid merchant is required.",
    )
  })

  it("rejects an unknown merchant", () => {
    expect(validateIssueCard({ ...VALID, merchantId: "mch_does_not_exist" })).toContain(
      "A valid merchant is required.",
    )
  })

  it("rejects a zero spend limit", () => {
    expect(validateIssueCard({ ...VALID, spendLimit: 0 })).toContain(
      "Spend limit must be greater than zero.",
    )
  })

  it("rejects a negative spend limit", () => {
    expect(validateIssueCard({ ...VALID, spendLimit: -500 })).toContain(
      "Spend limit must be greater than zero.",
    )
  })

  it("rejects a spend limit above the cap", () => {
    expect(
      validateIssueCard({ ...VALID, spendLimit: MAX_SPEND_LIMIT + 1 }),
    ).toContain(`Spend limit cannot exceed ${MAX_SPEND_LIMIT.toLocaleString()} minor units.`)
  })

  it("accepts a spend limit exactly at the cap", () => {
    expect(validateIssueCard({ ...VALID, spendLimit: MAX_SPEND_LIMIT })).toEqual([])
  })

  it("rejects a currency outside USD/EUR/GBP", () => {
    // @ts-expect-error deliberately invalid for the test
    expect(validateIssueCard({ ...VALID, currency: "JPY" })).toContain(
      "Currency must be one of USD, EUR, GBP.",
    )
  })

  it("rejects a currency that does not match the merchant's own", () => {
    // mch_01 (Lumen Coffee Roasters) settles in USD, not GBP.
    const errors = validateIssueCard({ ...VALID, currency: "GBP" })
    expect(errors.some((e) => e.includes("settles in USD"))).toBe(true)
  })
})

describe("issueCard", () => {
  it("creates a card starting active, with no spend, and a masked-ready last4", () => {
    const { card, number } = issueCard(VALID)
    expect(card.status).toBe("active")
    expect(card.spend).toBe(0)
    expect(card.last4).toBe(number.slice(-4))
    expect(number.startsWith("4242")).toBe(true)
  })

  it("throws with a joined message when input is invalid", () => {
    expect(() => issueCard({ ...VALID, spendLimit: -1 })).toThrow(
      "Spend limit must be greater than zero.",
    )
  })

  it("never puts the full number on the card record", () => {
    const { card } = issueCard(VALID)
    expect(JSON.stringify(card)).not.toMatch(/\d{16}/)
  })

  it("starts the audit trail with the initial active status", () => {
    const { card } = issueCard(VALID)
    expect(card.history).toEqual([{ status: "active", at: card.createdAt }])
  })
})

describe("issueCardIdempotent", () => {
  it("returns the same card for a repeated key without a second number", () => {
    const first = issueCardIdempotent(VALID, "key-1")
    const second = issueCardIdempotent(VALID, "key-1")
    expect(second.card.id).toBe(first.card.id)
    expect(second.number).toBeNull()
    expect(store.cards).toHaveLength(1)
  })

  it("issues a distinct card for a different key", () => {
    const first = issueCardIdempotent(VALID, "key-1")
    const second = issueCardIdempotent(VALID, "key-2")
    expect(second.card.id).not.toBe(first.card.id)
    expect(store.cards).toHaveLength(2)
  })
})

describe("card status transitions", () => {
  const cases: [string, string, boolean][] = [
    ["active", "frozen", true],
    ["active", "cancelled", true],
    ["active", "active", false],
    ["frozen", "active", true],
    ["frozen", "cancelled", true],
    ["frozen", "frozen", false],
    ["cancelled", "active", false],
    ["cancelled", "frozen", false],
    ["cancelled", "cancelled", false],
  ]

  it.each(cases)("%s -> %s is allowed: %s", (from, to, allowed) => {
    expect(canTransition(from as never, to as never)).toBe(allowed)
  })

  it("cancelled is terminal even via transitionCard", () => {
    const { card } = issueCard(VALID)
    transitionCard(card.id, "cancelled")
    expect(() => transitionCard(card.id, "active")).toThrow()
    expect(() => transitionCard(card.id, "frozen")).toThrow()
  })

  it("active can go to frozen and back", () => {
    const { card } = issueCard(VALID)
    expect(transitionCard(card.id, "frozen").status).toBe("frozen")
    expect(transitionCard(card.id, "active").status).toBe("active")
  })

  it("appends every transition to the audit trail", () => {
    const { card } = issueCard(VALID)
    transitionCard(card.id, "frozen")
    transitionCard(card.id, "active")
    expect(card.history.map((h) => h.status)).toEqual(["active", "frozen", "active"])
  })
})
