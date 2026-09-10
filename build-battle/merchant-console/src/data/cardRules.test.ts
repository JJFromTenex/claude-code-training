import { describe, expect, it } from "vitest"
import {
  canTransition,
  CARD_STATUSES,
  MAX_SPEND_LIMIT,
  maskCardNumber,
  spendTone,
  validateIssueCard,
} from "./cardRules"
import { CardStatus } from "./types"

const valid = {
  nickname: "Ad spend",
  merchantId: "mch_05", // Brandt & Sohn, settles in EUR
  spendLimit: 25000,
  currency: "EUR",
  category: "advertising",
}

const errorsFor = (overrides: Record<string, unknown>) => {
  const result = validateIssueCard({ ...valid, ...overrides })
  return result.ok ? {} : result.errors
}

describe("validateIssueCard", () => {
  it("accepts a complete request and trims the nickname", () => {
    const result = validateIssueCard({ ...valid, nickname: "  Ad spend  " })
    expect(result).toEqual({ ok: true, value: { ...valid } })
  })

  it("rejects a missing or unknown merchant", () => {
    expect(errorsFor({ merchantId: undefined }).merchantId).toBeDefined()
    expect(errorsFor({ merchantId: "" }).merchantId).toBeDefined()
    expect(errorsFor({ merchantId: "mch_99" }).merchantId).toBeDefined()
  })

  it("rejects a zero or negative limit", () => {
    expect(errorsFor({ spendLimit: 0 }).spendLimit).toBeDefined()
    expect(errorsFor({ spendLimit: -100 }).spendLimit).toBeDefined()
  })

  it("accepts exactly the maximum and rejects one minor unit over", () => {
    expect(errorsFor({ spendLimit: MAX_SPEND_LIMIT }).spendLimit).toBeUndefined()
    expect(errorsFor({ spendLimit: MAX_SPEND_LIMIT + 1 }).spendLimit).toBeDefined()
  })

  it("never parses a limit: floats and money strings are rejected", () => {
    expect(errorsFor({ spendLimit: 250.5 }).spendLimit).toBeDefined()
    expect(errorsFor({ spendLimit: "250.00" }).spendLimit).toBeDefined()
    expect(errorsFor({ spendLimit: "25000" }).spendLimit).toBeDefined()
    expect(errorsFor({ spendLimit: Number.NaN }).spendLimit).toBeDefined()
  })

  it("rejects a currency outside USD, EUR, GBP", () => {
    expect(errorsFor({ currency: "XYZ" }).currency).toBeDefined()
    expect(errorsFor({ currency: "eur" }).currency).toBeDefined()
    expect(errorsFor({ currency: undefined }).currency).toBeDefined()
  })

  it("rejects a currency that does not match the merchant's", () => {
    expect(errorsFor({ currency: "GBP" }).currency).toMatch(/settles in EUR/)
    expect(errorsFor({ merchantId: "mch_04", currency: "GBP" })).toEqual({})
  })

  it("requires a nickname and a known category", () => {
    expect(errorsFor({ nickname: "   " }).nickname).toBeDefined()
    expect(errorsFor({ nickname: "x".repeat(41) }).nickname).toBeDefined()
    expect(errorsFor({ category: "gambling" }).category).toBeDefined()
  })

  it("reports every problem at once, and survives a non-object body", () => {
    const result = validateIssueCard(null)
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(Object.keys(result.errors).sort()).toEqual(
        ["category", "currency", "merchantId", "nickname", "spendLimit"],
      )
    }
  })
})

describe("canTransition", () => {
  const allowed: [CardStatus, CardStatus][] = [
    ["active", "frozen"],
    ["frozen", "active"],
    ["active", "cancelled"],
    ["frozen", "cancelled"],
  ]

  it("allows freeze, unfreeze, and cancel from either live state", () => {
    for (const [from, to] of allowed) expect(canTransition(from, to)).toBe(true)
  })

  it("rejects every other move, including a no-op", () => {
    for (const from of CARD_STATUSES) {
      for (const to of CARD_STATUSES) {
        const isAllowed = allowed.some(([f, t]) => f === from && t === to)
        expect(canTransition(from, to)).toBe(isAllowed)
      }
    }
  })

  it("treats cancelled as terminal", () => {
    expect(canTransition("cancelled", "active")).toBe(false)
    expect(canTransition("cancelled", "frozen")).toBe(false)
  })
})

describe("maskCardNumber", () => {
  it("shows the last four only", () => {
    expect(maskCardNumber("4242")).toBe("•••• 4242")
  })
})

describe("spendTone", () => {
  it("stays normal up to and including 80% of the limit", () => {
    expect(spendTone(0, 25000)).toBe("normal")
    expect(spendTone(20000, 25000)).toBe("normal")
  })

  it("turns amber one minor unit past 80%", () => {
    expect(spendTone(20001, 25000)).toBe("warning")
    expect(spendTone(25000, 25000)).toBe("warning")
  })
})
