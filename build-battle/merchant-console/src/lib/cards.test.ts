import { describe, expect, it } from "vitest"
import { generateCardNumber, luhnCheckDigit, maskCardNumber } from "./cards"

/**
 * Every generated number must be indistinguishable-in-shape from a real PAN
 * while being unmistakably on the 4242 test BIN. These tests exist because a
 * generator that "usually" passes Luhn is worse than one that never runs.
 */

function isValidLuhn(number: string): boolean {
  let sum = 0
  let double = false
  for (let i = number.length - 1; i >= 0; i--) {
    let value = Number(number[i])
    if (double) {
      value *= 2
      if (value > 9) value -= 9
    }
    sum += value
    double = !double
  }
  return sum % 10 === 0
}

describe("luhnCheckDigit", () => {
  it("matches a known-good check digit", () => {
    // 4242424242424242 is the canonical Stripe test PAN.
    expect(luhnCheckDigit("424242424242424")).toBe(2)
  })
})

describe("generateCardNumber", () => {
  it("always starts with the 4242 test BIN and is 16 digits", () => {
    for (let i = 0; i < 200; i++) {
      const number = generateCardNumber()
      expect(number).toHaveLength(16)
      expect(number.startsWith("4242")).toBe(true)
      expect(/^\d{16}$/.test(number)).toBe(true)
    }
  })

  it("always passes Luhn", () => {
    for (let i = 0; i < 200; i++) {
      expect(isValidLuhn(generateCardNumber())).toBe(true)
    }
  })
})

describe("maskCardNumber", () => {
  it("renders the fixed display mask", () => {
    expect(maskCardNumber("7391")).toBe("•••• 4242")
  })
})
