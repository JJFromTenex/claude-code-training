import { describe, expect, it } from "vitest"
import {
  TEST_BIN,
  allowedTransitions,
  canTransition,
  generateCardNumber,
  isLuhnValid,
  lastFour,
  luhnCheckDigit,
  maskCardNumber,
  spendRatio,
} from "./cards"

/**
 * The generator and the state machine are the two things in NWP-201 that are
 * not allowed to be "probably right", so they are the two things with tests.
 */

describe("isLuhnValid", () => {
  it("accepts known-good test numbers", () => {
    expect(isLuhnValid("4242424242424242")).toBe(true)
  })

  it("rejects a number with a bad check digit", () => {
    expect(isLuhnValid("4242424242424243")).toBe(false)
  })

  it("rejects anything that is not all digits", () => {
    expect(isLuhnValid("4242-4242-4242-4242")).toBe(false)
    expect(isLuhnValid("")).toBe(false)
  })
})

describe("luhnCheckDigit", () => {
  it("produces the digit that completes a valid number", () => {
    const partial = "424242424242424"
    const complete = partial + String(luhnCheckDigit(partial))
    expect(complete).toBe("4242424242424242")
    expect(isLuhnValid(complete)).toBe(true)
  })
})

describe("generateCardNumber", () => {
  it("is deterministic when the randomness is", () => {
    const zeros = () => 0
    expect(generateCardNumber(zeros)).toBe("4242000000000000")
    expect(isLuhnValid(generateCardNumber(zeros))).toBe(true)
  })

  it("always starts with the 4242 test BIN, is 16 digits, and passes Luhn", () => {
    // The invariant that keeps a real-looking PAN out of this repository.
    for (let i = 0; i < 1000; i++) {
      const pan = generateCardNumber()
      expect(pan).toHaveLength(16)
      expect(pan.startsWith(TEST_BIN)).toBe(true)
      expect(/^\d{16}$/.test(pan)).toBe(true)
      expect(isLuhnValid(pan)).toBe(true)
    }
  })
})

describe("masking", () => {
  it("keeps only the last four", () => {
    expect(lastFour("4242000000001234")).toBe("1234")
  })

  it("renders the masked form used everywhere but the reveal", () => {
    expect(maskCardNumber("4242")).toBe("•••• 4242")
  })
})

describe("status transitions", () => {
  it("moves active to frozen and back", () => {
    expect(canTransition("active", "frozen")).toBe(true)
    expect(canTransition("frozen", "active")).toBe(true)
  })

  it("lets either state cancel", () => {
    expect(canTransition("active", "cancelled")).toBe(true)
    expect(canTransition("frozen", "cancelled")).toBe(true)
  })

  it("treats cancelled as terminal", () => {
    expect(canTransition("cancelled", "active")).toBe(false)
    expect(canTransition("cancelled", "frozen")).toBe(false)
    expect(canTransition("cancelled", "cancelled")).toBe(false)
    expect(allowedTransitions("cancelled")).toEqual([])
  })

  it("does not treat a no-op as a transition", () => {
    expect(canTransition("active", "active")).toBe(false)
    expect(canTransition("frozen", "frozen")).toBe(false)
  })
})

describe("spendRatio", () => {
  it("divides minor units by minor units", () => {
    expect(spendRatio(2500, 10000)).toBe(0.25)
  })

  it("clamps a card that is over its limit", () => {
    expect(spendRatio(15000, 10000)).toBe(1)
  })

  it("does not divide by zero", () => {
    expect(spendRatio(100, 0)).toBe(0)
  })
})
