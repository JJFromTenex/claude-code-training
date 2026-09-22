import { describe, expect, it } from "vitest"
import { generateCardNumber, isValidLuhn, luhnCheckDigit } from "./luhn"

describe("luhnCheckDigit", () => {
  it("matches the known check digit for a reference payload", () => {
    // 7992739871 -> 79927398713 is the textbook Luhn example.
    expect(luhnCheckDigit("7992739871")).toBe(3)
  })

  it("is deterministic for a given payload", () => {
    expect(luhnCheckDigit("424200000000000")).toBe(
      luhnCheckDigit("424200000000000"),
    )
  })
})

describe("isValidLuhn", () => {
  it("accepts a number whose check digit satisfies the checksum", () => {
    expect(isValidLuhn("79927398713")).toBe(true)
  })

  it("rejects a number with a wrong check digit", () => {
    expect(isValidLuhn("79927398710")).toBe(false)
  })
})

describe("generateCardNumber", () => {
  it("starts with the 4242 test BIN", () => {
    expect(generateCardNumber().startsWith("4242")).toBe(true)
  })

  it("is 16 digits long", () => {
    expect(generateCardNumber()).toHaveLength(16)
  })

  it("always carries a valid Luhn check digit", () => {
    for (let i = 0; i < 50; i++) {
      expect(isValidLuhn(generateCardNumber())).toBe(true)
    }
  })

  it("does not repeat the same number every call", () => {
    const numbers = new Set(Array.from({ length: 20 }, generateCardNumber))
    expect(numbers.size).toBeGreaterThan(1)
  })
})
