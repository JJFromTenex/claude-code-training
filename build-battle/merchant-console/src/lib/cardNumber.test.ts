import { describe, expect, it } from "vitest"
import {
  PAN_LENGTH,
  TEST_BIN,
  generateCardNumber,
  isValidLuhn,
  luhnCheckDigit,
  maskCardNumber,
} from "./cardNumber"

/**
 * The generator is the one piece of this feature that cannot be checked by
 * looking at the screen: a wrong check digit renders exactly like a right one.
 * Generation is random, so the shape assertions run over a sample rather than
 * a single call.
 */

const SAMPLE = 200

describe("luhnCheckDigit", () => {
  it("returns the digit that completes the checksum", () => {
    // 424242424242424 + 2 is the canonical 4242 test number.
    expect(luhnCheckDigit("424242424242424")).toBe(2)
  })

  it("returns zero when the partial already sums to a multiple of ten", () => {
    // 9 + (5 doubled, 10, cast down to 1) is 10, so nothing needs adding.
    expect(luhnCheckDigit("95")).toBe(0)
    expect(isValidLuhn("950")).toBe(true)
  })
})

describe("isValidLuhn", () => {
  it("accepts a known-good test number", () => {
    expect(isValidLuhn("4242424242424242")).toBe(true)
  })

  it("rejects a number whose check digit has been altered", () => {
    expect(isValidLuhn("4242424242424243")).toBe(false)
  })

  it("rejects a transposition that changes the checksum", () => {
    expect(isValidLuhn("4242424242424422")).toBe(false)
  })

  it("rejects anything that is not all digits", () => {
    expect(isValidLuhn("4242-4242-4242-4242")).toBe(false)
    expect(isValidLuhn("")).toBe(false)
  })
})

describe("generateCardNumber", () => {
  const numbers = Array.from({ length: SAMPLE }, () => generateCardNumber())

  it("always starts with the 4242 test BIN", () => {
    // Nothing in this repository may resemble a real PAN, ever.
    for (const { full } of numbers) {
      expect(full.startsWith(TEST_BIN)).toBe(true)
    }
  })

  it("always produces sixteen digits", () => {
    for (const { full } of numbers) {
      expect(full).toMatch(/^\d+$/)
      expect(full).toHaveLength(PAN_LENGTH)
    }
  })

  it("always carries a valid Luhn check digit", () => {
    for (const { full } of numbers) {
      expect(isValidLuhn(full)).toBe(true)
    }
  })

  it("returns the last four of the number it generated", () => {
    for (const { full, last4 } of numbers) {
      expect(last4).toBe(full.slice(-4))
      expect(last4).toHaveLength(4)
    }
  })

  it("does not return the same number twice across a sample", () => {
    const unique = new Set(numbers.map((n) => n.full))
    expect(unique.size).toBe(SAMPLE)
  })
})

describe("maskCardNumber", () => {
  it("renders the one masking format the console uses", () => {
    expect(maskCardNumber("4242")).toBe("•••• 4242")
  })
})
