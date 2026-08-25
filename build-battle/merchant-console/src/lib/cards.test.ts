import { describe, expect, it } from "vitest"
import {
  CARD_BIN,
  MAX_SPEND_LIMIT_MINOR,
  canTransition,
  generateCardNumber,
  isValidLuhn,
  luhnCheckDigit,
  maskLast4,
  spendFraction,
  validateCardInput,
} from "./cards"

/**
 * The Luhn generator and the state machine are the two rules the ticket
 * calls out by name, so they get the most coverage here.
 */

describe("luhnCheckDigit / isValidLuhn", () => {
  it("computes the known Stripe test number's check digit", () => {
    // 4242 4242 4242 4242 is Luhn-valid end to end.
    expect(isValidLuhn("4242424242424242")).toBe(true)
    // Flipping the last digit breaks it.
    expect(isValidLuhn("4242424242424241")).toBe(false)
  })

  it("rejects non-digit input", () => {
    expect(isValidLuhn("4242abcd42424242")).toBe(false)
  })
})

describe("generateCardNumber", () => {
  it("always starts with the 4242 test BIN and is 16 digits", () => {
    for (let i = 0; i < 200; i++) {
      const number = generateCardNumber(() => Math.random())
      expect(number.startsWith(CARD_BIN)).toBe(true)
      expect(number).toHaveLength(16)
      expect(number).toMatch(/^\d{16}$/)
    }
  })

  it("always carries a valid Luhn check digit", () => {
    for (let i = 0; i < 200; i++) {
      const number = generateCardNumber(() => Math.random())
      expect(isValidLuhn(number)).toBe(true)
    }
  })

  it("is deterministic for a fixed random source", () => {
    const fixed = () => 0.5
    expect(generateCardNumber(fixed)).toBe(generateCardNumber(fixed))
  })
})

describe("maskLast4", () => {
  it("masks everywhere but the reveal", () => {
    expect(maskLast4("4242")).toBe("•••• 4242")
  })
})

describe("canTransition", () => {
  it("allows active and frozen to flip between each other", () => {
    expect(canTransition("active", "frozen")).toBe(true)
    expect(canTransition("frozen", "active")).toBe(true)
  })

  it("allows either active state to cancel", () => {
    expect(canTransition("active", "cancelled")).toBe(true)
    expect(canTransition("frozen", "cancelled")).toBe(true)
  })

  it("treats cancelled as terminal", () => {
    expect(canTransition("cancelled", "active")).toBe(false)
    expect(canTransition("cancelled", "frozen")).toBe(false)
    expect(canTransition("cancelled", "cancelled")).toBe(false)
  })

  it("rejects a no-op transition to the same status", () => {
    expect(canTransition("active", "active")).toBe(false)
  })
})

describe("validateCardInput", () => {
  const valid = {
    nickname: "Ad spend",
    merchantId: "mch_01",
    spendLimit: 25000,
    currency: "USD",
    category: "advertising",
  }

  it("accepts a fully valid input", () => {
    const result = validateCardInput(valid)
    expect(result.ok).toBe(true)
  })

  it("parses a decimal string limit through the shared money parser", () => {
    const result = validateCardInput({ ...valid, spendLimit: "250.00" })
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.value.spendLimit).toBe(25000)
  })

  it("rejects a missing nickname", () => {
    const result = validateCardInput({ ...valid, nickname: "  " })
    expect(result.ok).toBe(false)
  })

  it("rejects a missing or unknown merchant", () => {
    expect(validateCardInput({ ...valid, merchantId: undefined }).ok).toBe(false)
    expect(validateCardInput({ ...valid, merchantId: "mch_does_not_exist" }).ok).toBe(false)
  })

  it("rejects a zero or negative limit", () => {
    expect(validateCardInput({ ...valid, spendLimit: 0 }).ok).toBe(false)
    expect(validateCardInput({ ...valid, spendLimit: -100 }).ok).toBe(false)
  })

  it("rejects a limit above the 5,000,000 minor unit cap", () => {
    expect(validateCardInput({ ...valid, spendLimit: MAX_SPEND_LIMIT_MINOR }).ok).toBe(true)
    expect(validateCardInput({ ...valid, spendLimit: MAX_SPEND_LIMIT_MINOR + 1 }).ok).toBe(false)
  })

  it("rejects a currency outside USD, EUR, GBP", () => {
    expect(validateCardInput({ ...valid, currency: "JPY" }).ok).toBe(false)
  })

  it("rejects a currency that does not match the merchant's own currency", () => {
    // mch_01 (Lumen Coffee Roasters) is USD; EUR is a valid card currency in
    // isolation but wrong for this merchant.
    const result = validateCardInput({ ...valid, merchantId: "mch_01", currency: "EUR" })
    expect(result.ok).toBe(false)
  })

  it("accepts a currency that matches a non-USD merchant", () => {
    // mch_05 (Brandt & Sohn) is EUR.
    const result = validateCardInput({ ...valid, merchantId: "mch_05", currency: "EUR" })
    expect(result.ok).toBe(true)
  })

  it("rejects an unknown category", () => {
    expect(validateCardInput({ ...valid, category: "yacht" }).ok).toBe(false)
  })
})

describe("spendFraction", () => {
  it("clamps to [0, 1]", () => {
    expect(spendFraction({ spent: 0, spendLimit: 1000 })).toBe(0)
    expect(spendFraction({ spent: 500, spendLimit: 1000 })).toBe(0.5)
    expect(spendFraction({ spent: 2000, spendLimit: 1000 })).toBe(1)
  })
})
