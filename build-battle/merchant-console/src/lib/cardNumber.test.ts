import { describe, expect, it } from "vitest"
import { generateCardNumber, isLuhnValid, luhnCheckDigit, maskCardNumber } from "./cardNumber"

describe("luhnCheckDigit", () => {
  it("computes the known check digit for an all-zero payload", () => {
    expect(luhnCheckDigit("424200000000000")).toBe("0")
  })

  it("computes the known check digit for a mixed-digit payload", () => {
    expect(luhnCheckDigit("424212345678901")).toBe("5")
  })
})

describe("isLuhnValid", () => {
  it("accepts a number whose check digit is correct", () => {
    expect(isLuhnValid("4242000000000000")).toBe(true)
    expect(isLuhnValid("4242123456789015")).toBe(true)
  })

  it("rejects a number whose last digit is wrong", () => {
    expect(isLuhnValid("4242123456789016")).toBe(false)
  })
})

describe("generateCardNumber", () => {
  it("always starts with the 4242 test BIN, is 16 digits, and passes Luhn", () => {
    for (let i = 0; i < 50; i++) {
      const number = generateCardNumber()
      expect(number).toHaveLength(16)
      expect(number.startsWith("4242")).toBe(true)
      expect(isLuhnValid(number)).toBe(true)
    }
  })
})

describe("maskCardNumber", () => {
  it("shows the card's own real last four, not a constant", () => {
    expect(maskCardNumber("4242000000000000")).toBe("•••• 0000")
    expect(maskCardNumber("4242123456789015")).toBe("•••• 9015")
  })
})
