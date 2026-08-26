import { describe, expect, it } from "vitest"
import {
  CARD_BIN,
  CARD_NUMBER_LENGTH,
  MAX_SPEND_LIMIT_MINOR,
  allowedTransitions,
  canTransition,
  generateCardNumber,
  generateCardReference,
  isLuhnValid,
  luhnCheckDigit,
  maskCardNumber,
  spendRatio,
  validateIssueRequest,
} from "./cards"

/**
 * A generated number that fails a Luhn check is a card the console cannot
 * issue, and a number that leaves the 4242 BIN is a number that resembles a
 * real PAN. Both are pinned here rather than eyeballed.
 */

const validIssue = {
  nickname: "Ad spend — Q3",
  merchantId: "mch_01",
  spendLimit: 250000,
  currency: "USD",
  category: "advertising",
}

describe("luhnCheckDigit", () => {
  it("computes the digit that completes a known number", () => {
    // 4242424242424242 is the canonical test number; its payload is the first 15.
    expect(luhnCheckDigit("424242424242424")).toBe(2)
  })

  it("always returns a single digit", () => {
    for (let i = 0; i < 200; i++) {
      const digit = luhnCheckDigit(generateCardNumber().slice(0, -1))
      expect(digit).toBeGreaterThanOrEqual(0)
      expect(digit).toBeLessThanOrEqual(9)
    }
  })
})

describe("isLuhnValid", () => {
  it("accepts the canonical test number", () => {
    expect(isLuhnValid("4242424242424242")).toBe(true)
  })

  it("rejects a number with a transposed digit", () => {
    expect(isLuhnValid("4242424242424243")).toBe(false)
  })

  it("rejects anything that is not digits", () => {
    expect(isLuhnValid("4242-4242-4242-4242")).toBe(false)
    expect(isLuhnValid("")).toBe(false)
  })
})

describe("generateCardNumber", () => {
  it("is always 16 digits on the 4242 BIN with a valid check digit", () => {
    const shape = new RegExp(`^${CARD_BIN}\\d{${CARD_NUMBER_LENGTH - 4}}$`)
    for (let i = 0; i < 500; i++) {
      const number = generateCardNumber()
      expect(number).toMatch(shape)
      expect(isLuhnValid(number)).toBe(true)
    }
  })

  it("is deterministic when the randomness is", () => {
    const zeros = () => 0
    expect(generateCardNumber(zeros)).toBe(generateCardNumber(zeros))
    expect(isLuhnValid(generateCardNumber(zeros))).toBe(true)
  })
})

describe("generateCardReference", () => {
  it("is not the card number, and carries no digits of one", () => {
    const ref = generateCardReference()
    expect(ref).toMatch(/^cref_[0-9a-f]{12}$/)
    expect(ref).not.toContain(CARD_BIN)
  })
})

describe("maskCardNumber", () => {
  it("shows the last four and nothing more", () => {
    expect(maskCardNumber("4242")).toBe("•••• 4242")
  })
})

describe("the status state machine", () => {
  it("freezes and unfreezes", () => {
    expect(canTransition("active", "frozen")).toBe(true)
    expect(canTransition("frozen", "active")).toBe(true)
  })

  it("cancels from either live state", () => {
    expect(canTransition("active", "cancelled")).toBe(true)
    expect(canTransition("frozen", "cancelled")).toBe(true)
  })

  it("treats cancelled as terminal — nothing comes back", () => {
    expect(canTransition("cancelled", "active")).toBe(false)
    expect(canTransition("cancelled", "frozen")).toBe(false)
    expect(canTransition("cancelled", "cancelled")).toBe(false)
    expect(allowedTransitions("cancelled")).toEqual([])
  })

  it("refuses a no-op transition to its own state", () => {
    expect(canTransition("active", "active")).toBe(false)
    expect(canTransition("frozen", "frozen")).toBe(false)
  })
})

describe("spendRatio", () => {
  it("reports spend against limit", () => {
    expect(spendRatio({ spent: 25000, spendLimit: 100000 })).toBe(0.25)
  })

  it("caps at 1 rather than reporting over-spend as more than full", () => {
    expect(spendRatio({ spent: 200000, spendLimit: 100000 })).toBe(1)
  })

  it("does not divide by a zero limit", () => {
    expect(spendRatio({ spent: 500, spendLimit: 0 })).toBe(0)
  })
})

describe("validateIssueRequest", () => {
  it("accepts a well-formed request", () => {
    const result = validateIssueRequest(validIssue)
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.value.spendLimit).toBe(250000)
  })

  it("trims the nickname rather than storing the whitespace", () => {
    const result = validateIssueRequest({ ...validIssue, nickname: "  Ads  " })
    expect(result.ok && result.value.nickname).toBe("Ads")
  })

  it("treats an absent category as unrestricted rather than invalid", () => {
    const result = validateIssueRequest({ ...validIssue, category: undefined })
    expect(result.ok && result.value.category).toBe(null)
  })

  // Each row is a request the server must refuse. The client's own checks are
  // a convenience; these are the enforcement.
  it.each([
    ["a blank nickname", { nickname: "   " }],
    ["a missing merchant", { merchantId: "" }],
    ["an unknown merchant", { merchantId: "mch_nope" }],
    ["a zero limit", { spendLimit: 0 }],
    ["a negative limit", { spendLimit: -1 }],
    ["a limit above the ceiling", { spendLimit: MAX_SPEND_LIMIT_MINOR + 1 }],
    ["a float limit, because money is integer minor units", { spendLimit: 250.5 }],
    ["a limit sent as a string", { spendLimit: "25000" }],
    ["a currency outside the allowlist", { currency: "JPY" }],
    ["a lowercased currency", { currency: "usd" }],
    ["a currency the merchant does not settle in", { currency: "EUR" }],
    ["a category outside the allowlist", { category: "weapons" }],
  ])("rejects %s", (_label, patch) => {
    expect(validateIssueRequest({ ...validIssue, ...patch }).ok).toBe(false)
  })

  it("accepts the ceiling itself, not just below it", () => {
    expect(
      validateIssueRequest({ ...validIssue, spendLimit: MAX_SPEND_LIMIT_MINOR }).ok,
    ).toBe(true)
  })

  it("names the merchant's currency when it refuses a mismatch", () => {
    const result = validateIssueRequest({ ...validIssue, currency: "EUR" })
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.message).toContain("USD")
  })

  it("accepts each merchant in the currency it actually settles in", () => {
    expect(
      validateIssueRequest({ ...validIssue, merchantId: "mch_01", currency: "USD" }).ok,
    ).toBe(true)
    expect(
      validateIssueRequest({ ...validIssue, merchantId: "mch_04", currency: "GBP" }).ok,
    ).toBe(true)
  })

  it("rejects a body that is not an object", () => {
    expect(validateIssueRequest(null).ok).toBe(false)
    expect(validateIssueRequest("nickname=x").ok).toBe(false)
  })
})
