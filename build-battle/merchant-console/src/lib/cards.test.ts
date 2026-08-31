import { describe, expect, it } from "vitest"
import {
  canTransition,
  generateCardNumber,
  isNearLimit,
  isValidCardCurrency,
  isValidCardLimit,
  isValidLuhn,
  maskNumber,
  spendRatio,
} from "./cards"

describe("generateCardNumber", () => {
  it("starts with the 4242 test BIN and is 16 digits", () => {
    for (let i = 0; i < 25; i++) {
      const number = generateCardNumber()
      expect(number).toMatch(/^4242\d{12}$/)
    }
  })

  it("always carries a valid Luhn check digit", () => {
    for (let i = 0; i < 25; i++) {
      expect(isValidLuhn(generateCardNumber())).toBe(true)
    }
  })
})

describe("isValidLuhn", () => {
  it("accepts a known-valid test number", () => {
    expect(isValidLuhn("4532015112830366")).toBe(true)
  })

  it("rejects the same number with its last digit changed", () => {
    expect(isValidLuhn("4532015112830367")).toBe(false)
  })
})

describe("maskNumber", () => {
  it("shows only the last four, dot-masked", () => {
    expect(maskNumber("4242")).toBe("•••• 4242")
  })
})

describe("canTransition", () => {
  it("allows active and frozen to flip back and forth", () => {
    expect(canTransition("active", "frozen")).toBe(true)
    expect(canTransition("frozen", "active")).toBe(true)
  })

  it("allows either active or frozen to cancel", () => {
    expect(canTransition("active", "cancelled")).toBe(true)
    expect(canTransition("frozen", "cancelled")).toBe(true)
  })

  it("treats cancelled as terminal — nothing comes back from it", () => {
    expect(canTransition("cancelled", "active")).toBe(false)
    expect(canTransition("cancelled", "frozen")).toBe(false)
  })

  it("rejects a no-op transition to the same status", () => {
    expect(canTransition("active", "active")).toBe(false)
  })
})

describe("isValidCardCurrency", () => {
  it("accepts USD, EUR, GBP", () => {
    expect(isValidCardCurrency("USD")).toBe(true)
    expect(isValidCardCurrency("EUR")).toBe(true)
    expect(isValidCardCurrency("GBP")).toBe(true)
  })

  it("rejects anything else, including a lowercase match", () => {
    expect(isValidCardCurrency("JPY")).toBe(false)
    expect(isValidCardCurrency("usd")).toBe(false)
    expect(isValidCardCurrency(undefined)).toBe(false)
  })
})

describe("isValidCardLimit", () => {
  it("rejects zero and negative limits", () => {
    expect(isValidCardLimit(0)).toBe(false)
    expect(isValidCardLimit(-100)).toBe(false)
  })

  it("rejects a limit above 5,000,000 minor units", () => {
    expect(isValidCardLimit(5_000_001)).toBe(false)
    expect(isValidCardLimit(5_000_000)).toBe(true)
  })

  it("rejects a non-integer amount", () => {
    expect(isValidCardLimit(250.5)).toBe(false)
  })

  it("accepts an ordinary positive integer limit", () => {
    expect(isValidCardLimit(25000)).toBe(true)
  })
})

describe("spendRatio / isNearLimit", () => {
  it("turns amber at 80% spent, not before", () => {
    expect(isNearLimit(spendRatio(20000, 25000))).toBe(true)
    expect(isNearLimit(spendRatio(19999, 25000))).toBe(false)
  })

  it("clamps to 0 for a fresh card with nothing spent", () => {
    expect(spendRatio(0, 25000)).toBe(0)
  })

  it("clamps at 1 even if spend somehow exceeds the limit", () => {
    expect(spendRatio(30000, 25000)).toBe(1)
  })
})
