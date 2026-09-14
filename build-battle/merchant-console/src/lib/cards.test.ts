import { describe, expect, it } from "vitest"
import {
  CARD_NUMBER_LENGTH,
  CARD_TRANSITIONS,
  canTransition,
  generateCardNumber,
  isLuhnValid,
  lastFour,
  luhnCheckDigit,
  maskCardNumber,
  TEST_BIN,
} from "./cards"

/**
 * Fixtures here use the 4242 test BIN only. Nothing in this file may
 * resemble a real card number.
 */

describe("luhnCheckDigit", () => {
  it("computes the digit that makes the well-known test number valid", () => {
    // 4242 4242 4242 4242 is the canonical test PAN; its check digit is 2.
    expect(luhnCheckDigit("424242424242424")).toBe("2")
  })

  it("rejects non-digit input", () => {
    expect(() => luhnCheckDigit("4242x")).toThrow()
  })
})

describe("isLuhnValid", () => {
  it("accepts the canonical test number", () => {
    expect(isLuhnValid("4242424242424242")).toBe(true)
  })

  it("rejects a single transposed digit", () => {
    expect(isLuhnValid("4242424242424224")).toBe(false)
  })

  it("rejects a wrong check digit", () => {
    expect(isLuhnValid("4242424242424243")).toBe(false)
  })

  it("rejects non-numeric input", () => {
    expect(isLuhnValid("")).toBe(false)
    expect(isLuhnValid("4242-4242")).toBe(false)
  })
})

describe("generateCardNumber", () => {
  it("is 16 digits on the 4242 BIN with a valid check digit", () => {
    for (let i = 0; i < 500; i++) {
      const number = generateCardNumber()
      expect(number).toMatch(/^\d{16}$/)
      expect(number).toHaveLength(CARD_NUMBER_LENGTH)
      expect(number.startsWith(TEST_BIN)).toBe(true)
      expect(isLuhnValid(number)).toBe(true)
    }
  })

  it("is deterministic for an injected random source", () => {
    const zeros = () => 0
    expect(generateCardNumber(zeros)).toBe("4242000000000000")
    expect(isLuhnValid("4242000000000000")).toBe(true)
  })

  it("does not repeat across many draws", () => {
    const seen = new Set<string>()
    for (let i = 0; i < 1000; i++) seen.add(generateCardNumber())
    expect(seen.size).toBeGreaterThan(990)
  })
})

describe("masking", () => {
  it("keeps only the last four", () => {
    expect(lastFour("4242424242424242")).toBe("4242")
    expect(maskCardNumber("4242")).toBe("•••• 4242")
  })
})

describe("card status transitions", () => {
  it("active can freeze or cancel", () => {
    expect(canTransition("active", "frozen")).toBe(true)
    expect(canTransition("active", "cancelled")).toBe(true)
  })

  it("frozen can reactivate or cancel", () => {
    expect(canTransition("frozen", "active")).toBe(true)
    expect(canTransition("frozen", "cancelled")).toBe(true)
  })

  it("cancelled is terminal", () => {
    expect(CARD_TRANSITIONS.cancelled).toEqual([])
    expect(canTransition("cancelled", "active")).toBe(false)
    expect(canTransition("cancelled", "frozen")).toBe(false)
    expect(canTransition("cancelled", "cancelled")).toBe(false)
  })

  it("a no-op transition is not legal", () => {
    expect(canTransition("active", "active")).toBe(false)
    expect(canTransition("frozen", "frozen")).toBe(false)
  })
})
