import { describe, expect, it } from "vitest"
import { generateCardNumber, isValidLuhn, last4 } from "./cardNumber"

describe("generateCardNumber", () => {
  it("starts with the 4242 test BIN", () => {
    expect(generateCardNumber().startsWith("4242")).toBe(true)
  })

  it("is 16 digits", () => {
    const number = generateCardNumber()
    expect(number).toMatch(/^\d{16}$/)
  })

  it("carries a valid Luhn check digit", () => {
    for (let i = 0; i < 50; i++) {
      expect(isValidLuhn(generateCardNumber())).toBe(true)
    }
  })

  it("does not generate the same number twice in a row", () => {
    expect(generateCardNumber()).not.toBe(generateCardNumber())
  })
})

describe("isValidLuhn", () => {
  it("rejects a number with a broken check digit", () => {
    const number = generateCardNumber()
    const broken = number.slice(0, -1) + String((Number(number.at(-1)) + 1) % 10)
    expect(isValidLuhn(broken)).toBe(false)
  })
})

describe("last4", () => {
  it("returns the final four digits", () => {
    expect(last4("4242123456789012")).toBe("9012")
  })
})
