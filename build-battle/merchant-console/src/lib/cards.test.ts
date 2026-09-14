import { describe, expect, it } from "vitest"
import { CARD_TRANSITIONS, canTransition, generateCardNumber, isLuhnValid, luhnCheckDigit, maskCardNumber } from "./cards"

// Fixtures use the 4242 test BIN only; nothing here may resemble a real card number.

describe("luhn", () => {
  it("computes the check digit of the canonical test number", () => {
    expect(luhnCheckDigit("424242424242424")).toBe("2")
    expect(isLuhnValid("4242424242424242")).toBe(true)
  })
  it("rejects a transposition, a wrong check digit, and non-digits", () => {
    expect(isLuhnValid("4242424242424224")).toBe(false)
    expect(isLuhnValid("4242424242424243")).toBe(false)
    expect(isLuhnValid("4242-4242")).toBe(false)
    expect(() => luhnCheckDigit("4242x")).toThrow()
  })
})

describe("generateCardNumber", () => {
  it("is 16 digits on the 4242 BIN with a valid check digit, every time", () => {
    for (let i = 0; i < 500; i++) {
      const n = generateCardNumber()
      expect(n).toMatch(/^4242\d{12}$/)
      expect(isLuhnValid(n)).toBe(true)
    }
  })
  it("is deterministic for an injected random source", () => {
    expect(generateCardNumber(() => 0)).toBe("4242000000000000")
  })
  it("does not repeat across many draws", () => {
    const seen = new Set(Array.from({ length: 1000 }, () => generateCardNumber()))
    expect(seen.size).toBeGreaterThan(990)
  })
  it("masks to the last four", () => {
    expect(maskCardNumber("4242")).toBe("•••• 4242")
  })
})

describe("status transitions", () => {
  it("active ⇄ frozen, either → cancelled", () => {
    expect(canTransition("active", "frozen")).toBe(true)
    expect(canTransition("frozen", "active")).toBe(true)
    expect(canTransition("active", "cancelled")).toBe(true)
    expect(canTransition("frozen", "cancelled")).toBe(true)
  })
  it("cancelled is terminal and no-ops are not moves", () => {
    expect(CARD_TRANSITIONS.cancelled).toEqual([])
    expect(canTransition("cancelled", "active")).toBe(false)
    expect(canTransition("cancelled", "frozen")).toBe(false)
    expect(canTransition("active", "active")).toBe(false)
  })
})
