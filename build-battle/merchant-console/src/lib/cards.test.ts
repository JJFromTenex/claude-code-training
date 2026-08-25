import { describe, expect, it } from "vitest"
import {
  CARD_NUMBER_LENGTH,
  TEST_BIN,
  formatCardNumber,
  generateCardNumber,
  isValidLuhn,
  lastFour,
  luhnCheckDigit,
  maskCardNumber,
} from "./cards"

/**
 * A generated number that fails Luhn, or that lands off the 4242 BIN, is the
 * one defect in this feature that cannot be spotted by looking at the screen.
 * So it gets the tests.
 */

describe("luhnCheckDigit", () => {
  it("returns the digit that completes a known sequence", () => {
    // 4242424242424242 is the canonical test PAN: body + 2 is valid.
    expect(luhnCheckDigit("424242424242424")).toBe(2)
  })

  it("agrees with the published Luhn worked example", () => {
    // 79927398713 is the reference number from the Luhn algorithm's own
    // description, so this case is independent of anything in this file.
    expect(luhnCheckDigit("7992739871")).toBe(3)
    expect(isValidLuhn("79927398713")).toBe(true)
  })

  it("returns 0 when the checksum is already complete", () => {
    expect(luhnCheckDigit("00000000000000")).toBe(0)
  })

  it("rejects anything that is not digits", () => {
    expect(() => luhnCheckDigit("4242-4242")).toThrow()
    expect(() => luhnCheckDigit("")).toThrow()
  })
})

describe("isValidLuhn", () => {
  it("accepts a valid number", () => {
    expect(isValidLuhn("4242424242424242")).toBe(true)
  })

  it("rejects a number with a wrong check digit", () => {
    expect(isValidLuhn("4242424242424243")).toBe(false)
  })

  it("rejects a transposition that changes the checksum", () => {
    expect(isValidLuhn("4242424242424422")).toBe(false)
  })

  it("rejects non-numeric input", () => {
    expect(isValidLuhn("•••• 4242")).toBe(false)
    expect(isValidLuhn("")).toBe(false)
  })
})

describe("generateCardNumber", () => {
  it("is sixteen digits on the test BIN", () => {
    const number = generateCardNumber()
    expect(number).toHaveLength(CARD_NUMBER_LENGTH)
    expect(number.startsWith(TEST_BIN)).toBe(true)
    expect(number).toMatch(/^\d{16}$/)
  })

  it("always carries a valid check digit", () => {
    // Deterministic sweep: every filler digit, and a thousand random draws.
    for (let d = 0; d <= 9; d++) {
      expect(isValidLuhn(generateCardNumber(() => d / 10))).toBe(true)
    }
    for (let i = 0; i < 1000; i++) {
      const number = generateCardNumber()
      expect(isValidLuhn(number)).toBe(true)
      expect(number.startsWith(TEST_BIN)).toBe(true)
    }
  })

  it("is pinned by the injected random source", () => {
    const number = generateCardNumber(() => 0)
    expect(number).toBe("4242000000000000")
    expect(isValidLuhn(number)).toBe(true)
  })

  it("varies between calls", () => {
    const drawn = new Set(Array.from({ length: 50 }, () => generateCardNumber()))
    expect(drawn.size).toBeGreaterThan(1)
  })
})

describe("lastFour and masking", () => {
  it("keeps only the last four digits", () => {
    expect(lastFour("4242424242424242")).toBe("4242")
    expect(lastFour("4242000000001236")).toBe("1236")
  })

  it("masks everything but the last four", () => {
    expect(maskCardNumber("1236")).toBe("•••• 1236")
    expect(maskCardNumber("4242")).toBe("•••• 4242")
  })

  it("groups a full number for the reveal screen only", () => {
    expect(formatCardNumber("4242424242424242")).toBe("4242 4242 4242 4242")
  })
})
