import { describe, expect, it } from "vitest"
import {
  CARD_NUMBER_LENGTH,
  canTransition,
  generateCardNumber,
  isLuhnValid,
  luhnCheckDigit,
  maskCardNumber,
  nextStatuses,
  TEST_BIN,
} from "./cards"

/**
 * Every number in this file is on the 4242 test BIN or is a textbook Luhn
 * example. Nothing here may resemble a real PAN.
 */

describe("luhnCheckDigit", () => {
  it("computes the textbook check digit", () => {
    // 7992739871 + 3 is the worked example in the Luhn description.
    expect(luhnCheckDigit("7992739871")).toBe("3")
  })

  it("produces a number that validates", () => {
    const payload = "424200000000000"
    expect(isLuhnValid(payload + luhnCheckDigit(payload))).toBe(true)
  })
})

describe("isLuhnValid", () => {
  it("accepts the canonical 4242 test number", () => {
    expect(isLuhnValid("4242424242424242")).toBe(true)
  })

  it("rejects a single-digit change", () => {
    expect(isLuhnValid("4242424242424241")).toBe(false)
  })

  it("rejects anything that is not all digits", () => {
    expect(isLuhnValid("4242 4242 4242 4242")).toBe(false)
    expect(isLuhnValid("")).toBe(false)
  })
})

describe("generateCardNumber", () => {
  it("starts with the test BIN and is sixteen digits", () => {
    const number = generateCardNumber()
    expect(number.startsWith(TEST_BIN)).toBe(true)
    expect(number).toMatch(/^\d{16}$/)
    expect(number).toHaveLength(CARD_NUMBER_LENGTH)
  })

  it("always carries a valid check digit", () => {
    for (let i = 0; i < 500; i++) {
      expect(isLuhnValid(generateCardNumber())).toBe(true)
    }
  })

  it("does not hand out the same number twice in a batch", () => {
    const batch = new Set(Array.from({ length: 200 }, generateCardNumber))
    expect(batch.size).toBe(200)
  })
})

describe("maskCardNumber", () => {
  it("shows only the last four", () => {
    expect(maskCardNumber("4242")).toBe("•••• 4242")
  })
})

describe("card status transitions", () => {
  it("moves active to frozen and back", () => {
    expect(canTransition("active", "frozen")).toBe(true)
    expect(canTransition("frozen", "active")).toBe(true)
  })

  it("lets active and frozen cards be cancelled", () => {
    expect(canTransition("active", "cancelled")).toBe(true)
    expect(canTransition("frozen", "cancelled")).toBe(true)
  })

  it("treats cancelled as terminal", () => {
    expect(canTransition("cancelled", "active")).toBe(false)
    expect(canTransition("cancelled", "frozen")).toBe(false)
    expect(canTransition("cancelled", "cancelled")).toBe(false)
    expect(nextStatuses("cancelled")).toEqual([])
  })

  it("does not count staying put as a transition", () => {
    expect(canTransition("active", "active")).toBe(false)
    expect(canTransition("frozen", "frozen")).toBe(false)
  })
})
