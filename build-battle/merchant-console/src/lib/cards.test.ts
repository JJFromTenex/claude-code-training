import { describe, expect, it } from "vitest"
import {
  TEST_BIN,
  generateCardNumber,
  isLuhnValid,
  isNearLimit,
  luhnCheckDigit,
  maskCardNumber,
  spendBarSteps,
} from "./cards"

/**
 * The check digit is the part that is easy to get subtly wrong: doubling from
 * the wrong end, or forgetting to subtract nine, both produce numbers that
 * look fine and fail every validator. The vectors below are computed by hand.
 */

describe("luhnCheckDigit", () => {
  it("matches hand-computed vectors", () => {
    // 79927398713 is the canonical Luhn example.
    expect(luhnCheckDigit("7992739871")).toBe(3)
    // 4242424242424242 is the industry test number, so its body must yield 2.
    expect(luhnCheckDigit("424242424242424")).toBe(2)
  })

  it("returns zero rather than ten when the sum lands on a multiple", () => {
    // 1231 sums to exactly 10, so the check digit is 0 and not 10.
    expect(luhnCheckDigit("1231")).toBe(0)
    expect(isLuhnValid("12310")).toBe(true)
  })
})

describe("isLuhnValid", () => {
  it("accepts a correct number and rejects a mutated digit", () => {
    expect(isLuhnValid("4242424242424242")).toBe(true)
    // Changing any single digit must break the checksum.
    expect(isLuhnValid("4242424242424243")).toBe(false)
    expect(isLuhnValid("4242424242424252")).toBe(false)
  })

  it("rejects anything that is not a run of digits", () => {
    expect(isLuhnValid("4242-4242-4242-4242")).toBe(false)
    expect(isLuhnValid("")).toBe(false)
    expect(isLuhnValid("4")).toBe(false)
  })
})

describe("generateCardNumber", () => {
  it("always produces a 16-digit, Luhn-valid number on the test BIN", () => {
    // Generation is random, so the property is asserted over many draws
    // rather than over one lucky number.
    for (let i = 0; i < 500; i++) {
      const pan = generateCardNumber()
      expect(pan).toMatch(/^\d{16}$/)
      expect(pan.startsWith(TEST_BIN)).toBe(true)
      expect(isLuhnValid(pan)).toBe(true)
    }
  })

  it("does not return the same number twice in a row", () => {
    expect(generateCardNumber()).not.toBe(generateCardNumber())
  })
})

describe("maskCardNumber", () => {
  it("renders the last four behind dots", () => {
    expect(maskCardNumber("4242")).toBe("•••• 4242")
  })
})

describe("isNearLimit", () => {
  it("turns on strictly past eighty percent", () => {
    // Exactly eighty percent is not past it, and the boundary is the whole
    // point of the amber state.
    expect(isNearLimit(80_000, 100_000)).toBe(false)
    expect(isNearLimit(80_001, 100_000)).toBe(true)
    expect(isNearLimit(100_000, 100_000)).toBe(true)
  })

  it("stays exact on limits that do not divide evenly", () => {
    // 2667 of 3333 is 80.02%. A float ratio makes this case a coin toss.
    expect(isNearLimit(2666, 3333)).toBe(false)
    expect(isNearLimit(2667, 3333)).toBe(true)
  })

  it("is false for a zero limit rather than dividing by it", () => {
    expect(isNearLimit(0, 0)).toBe(false)
    expect(isNearLimit(500, 0)).toBe(false)
  })
})

describe("spendBarSteps", () => {
  it("maps spend onto twentieths of the limit", () => {
    expect(spendBarSteps(0, 100_000)).toBe(0)
    expect(spendBarSteps(50_000, 100_000)).toBe(10)
    expect(spendBarSteps(100_000, 100_000)).toBe(20)
  })

  it("never runs past either end of the bar", () => {
    expect(spendBarSteps(250_000, 100_000)).toBe(20)
    expect(spendBarSteps(-100, 100_000)).toBe(0)
    expect(spendBarSteps(100, 0)).toBe(0)
  })
})
