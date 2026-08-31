import { describe, expect, it } from "vitest"
import {
  CARD_NUMBER_LENGTH,
  TEST_BIN,
  generateCardNumber,
  isNearLimit,
  isValidLuhn,
  luhnCheckDigit,
  maskCardNumber,
  spendRatio,
} from "./cards"

/**
 * A card number that fails its own check digit would look fine on screen and
 * be rejected by anything that validates it, so the generator is checked
 * against a Luhn implementation written separately from the one it uses.
 * Every fixture here is on the 4242 test BIN, tests included.
 */

describe("isValidLuhn", () => {
  it("accepts the published test number", () => {
    expect(isValidLuhn("4242424242424242")).toBe(true)
  })

  it("rejects the same number with one digit changed", () => {
    expect(isValidLuhn("4242424242424241")).toBe(false)
  })

  it("rejects anything that is not all digits", () => {
    expect(isValidLuhn("")).toBe(false)
    expect(isValidLuhn("4242-4242-4242-4242")).toBe(false)
    expect(isValidLuhn("424242424242424x")).toBe(false)
  })
})

describe("luhnCheckDigit", () => {
  it("returns the digit that completes the published test number", () => {
    expect(luhnCheckDigit("424242424242424")).toBe("2")
  })

  it("completes any partial into a valid number", () => {
    const partials = [
      "424200000000000",
      "424211111111111",
      "424298765432109",
      "424200000000001",
    ]
    for (const partial of partials) {
      expect(isValidLuhn(partial + luhnCheckDigit(partial))).toBe(true)
    }
  })
})

describe("generateCardNumber", () => {
  it("always uses the 4242 test BIN", () => {
    for (let i = 0; i < 200; i++) {
      expect(generateCardNumber().startsWith(TEST_BIN)).toBe(true)
    }
  })

  it("returns sixteen digits", () => {
    for (let i = 0; i < 200; i++) {
      expect(generateCardNumber()).toMatch(/^\d{16}$/)
      expect(generateCardNumber()).toHaveLength(CARD_NUMBER_LENGTH)
    }
  })

  it("returns a number that passes an independent Luhn check", () => {
    for (let i = 0; i < 200; i++) {
      expect(isValidLuhn(generateCardNumber())).toBe(true)
    }
  })

  it("is deterministic for a given random source", () => {
    const zeros = () => 0
    expect(generateCardNumber(zeros)).toBe(generateCardNumber(zeros))
    expect(isValidLuhn(generateCardNumber(zeros))).toBe(true)
  })
})

describe("maskCardNumber", () => {
  it("shows only the last four, behind bullets", () => {
    expect(maskCardNumber("4242")).toBe("•••• 4242")
  })
})

describe("spendRatio", () => {
  it("is zero when nothing has been spent", () => {
    expect(spendRatio(0, 25000)).toBe(0)
  })

  it("does not divide by a zero or negative limit", () => {
    expect(spendRatio(500, 0)).toBe(0)
    expect(spendRatio(500, -1)).toBe(0)
  })

  it("clamps a card spent past its limit to one", () => {
    expect(spendRatio(30000, 25000)).toBe(1)
  })
})

describe("isNearLimit", () => {
  it("warns at exactly eighty percent", () => {
    expect(isNearLimit(20000, 25000)).toBe(true)
  })

  it("stays quiet just below eighty percent", () => {
    expect(isNearLimit(19999, 25000)).toBe(false)
  })

  it("stays quiet on a card with no spend", () => {
    expect(isNearLimit(0, 25000)).toBe(false)
  })
})
