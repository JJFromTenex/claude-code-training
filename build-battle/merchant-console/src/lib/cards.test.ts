import { describe, expect, it } from "vitest"
import {
  CARD_BIN,
  CARD_NUMBER_LENGTH,
  canTransition,
  generateCardNumber,
  isValidLuhn,
  luhnCheckDigit,
  maskCard,
} from "./cards"

describe("luhnCheckDigit", () => {
  it("computes the digit that makes a number Luhn-valid", () => {
    // 4242424242424242 is the canonical test number; its check digit is 2.
    expect(luhnCheckDigit("424242424242424")).toBe(2)
  })
})

describe("isValidLuhn", () => {
  it("accepts the canonical 4242 test number", () => {
    expect(isValidLuhn("4242424242424242")).toBe(true)
  })

  it("rejects a number whose check digit is off by one", () => {
    expect(isValidLuhn("4242424242424243")).toBe(false)
  })

  it("rejects non-digit input", () => {
    expect(isValidLuhn("4242-4242")).toBe(false)
  })
})

describe("generateCardNumber", () => {
  it("always starts with the 4242 test BIN", () => {
    for (let i = 0; i < 200; i++) {
      expect(generateCardNumber().startsWith(CARD_BIN)).toBe(true)
    }
  })

  it("is 16 digits with a valid Luhn check digit", () => {
    for (let i = 0; i < 200; i++) {
      const number = generateCardNumber()
      expect(number).toMatch(/^\d{16}$/)
      expect(number).toHaveLength(CARD_NUMBER_LENGTH)
      expect(isValidLuhn(number)).toBe(true)
    }
  })

  it("is deterministic for an injected random source", () => {
    const fixed = () => 0.5
    expect(generateCardNumber(fixed)).toBe(generateCardNumber(fixed))
  })
})

describe("maskCard", () => {
  it("shows only the last four", () => {
    expect(maskCard("4242")).toBe("•••• 4242")
  })
})

describe("canTransition", () => {
  it("allows active ⇄ frozen", () => {
    expect(canTransition("active", "frozen")).toBe(true)
    expect(canTransition("frozen", "active")).toBe(true)
  })

  it("allows either live status to cancel", () => {
    expect(canTransition("active", "cancelled")).toBe(true)
    expect(canTransition("frozen", "cancelled")).toBe(true)
  })

  it("treats cancelled as terminal", () => {
    expect(canTransition("cancelled", "active")).toBe(false)
    expect(canTransition("cancelled", "frozen")).toBe(false)
    expect(canTransition("cancelled", "cancelled")).toBe(false)
  })

  it("rejects self-transitions on live statuses", () => {
    expect(canTransition("active", "active")).toBe(false)
    expect(canTransition("frozen", "frozen")).toBe(false)
  })
})
