import { describe, expect, it } from "vitest"
import {
  canTransitionCard,
  generateCardNumber,
  isLuhnValid,
  luhnCheckDigit,
  maskCard,
  TEST_BIN,
} from "./cards"

/**
 * Card numbers and the status machine are the two things NWP-201 is not
 * allowed to get wrong, so they are the two things with tests.
 */

describe("luhnCheckDigit", () => {
  it("reproduces the canonical 4242 test number", () => {
    expect(luhnCheckDigit("424242424242424")).toBe(2)
  })
})

describe("isLuhnValid", () => {
  it("accepts a valid number and rejects an off-by-one check digit", () => {
    expect(isLuhnValid("4242424242424242")).toBe(true)
    expect(isLuhnValid("4242424242424241")).toBe(false)
  })

  it("rejects non-digit input", () => {
    expect(isLuhnValid("4242-4242")).toBe(false)
    expect(isLuhnValid("")).toBe(false)
  })
})

describe("generateCardNumber", () => {
  it("is 16 digits on the test BIN with a valid check digit, every time", () => {
    for (let i = 0; i < 200; i++) {
      const number = generateCardNumber()
      expect(number).toMatch(/^\d{16}$/)
      expect(number.startsWith(TEST_BIN)).toBe(true)
      expect(isLuhnValid(number)).toBe(true)
    }
  })
})

describe("maskCard", () => {
  it("shows only the last four", () => {
    expect(maskCard("4242")).toBe("•••• 4242")
  })
})

describe("canTransitionCard", () => {
  it("allows active ⇄ frozen", () => {
    expect(canTransitionCard("active", "frozen")).toBe(true)
    expect(canTransitionCard("frozen", "active")).toBe(true)
  })

  it("allows either live status to cancel", () => {
    expect(canTransitionCard("active", "cancelled")).toBe(true)
    expect(canTransitionCard("frozen", "cancelled")).toBe(true)
  })

  it("treats cancelled as terminal", () => {
    expect(canTransitionCard("cancelled", "active")).toBe(false)
    expect(canTransitionCard("cancelled", "frozen")).toBe(false)
    expect(canTransitionCard("cancelled", "cancelled")).toBe(false)
  })

  it("rejects a transition to the same status", () => {
    expect(canTransitionCard("active", "active")).toBe(false)
    expect(canTransitionCard("frozen", "frozen")).toBe(false)
  })
})
