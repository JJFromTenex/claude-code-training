import { describe, expect, it } from "vitest"
import { generateCardNumber, isValidLuhn, luhnCheckDigit } from "./luhn"

describe("luhnCheckDigit", () => {
  it("produces the correct check digit for a known partial", () => {
    expect(luhnCheckDigit("424241632316104")).toBe("0")
  })

  it("produces a digit that makes the full number pass Luhn", () => {
    const partial = "424299887766554"
    const full = partial + luhnCheckDigit(partial)
    expect(isValidLuhn(full)).toBe(true)
  })
})

describe("isValidLuhn", () => {
  it("accepts a valid number", () => {
    expect(isValidLuhn("4242424242424242")).toBe(true)
  })

  it("rejects an invalid number", () => {
    expect(isValidLuhn("4242424242424241")).toBe(false)
  })

  it("rejects non-digit strings", () => {
    expect(isValidLuhn("4242-4242")).toBe(false)
  })

  it("rejects an empty string", () => {
    expect(isValidLuhn("")).toBe(false)
  })
})

describe("generateCardNumber", () => {
  it("generates 200 numbers that all start with 4242, are 16 digits, and pass Luhn", () => {
    for (let i = 0; i < 200; i++) {
      const number = generateCardNumber()
      expect(number).toHaveLength(16)
      expect(number.startsWith("4242")).toBe(true)
      expect(isValidLuhn(number)).toBe(true)
      expect(/^\d{16}$/.test(number)).toBe(true)
    }
  })

  it("produces distinct numbers across runs", () => {
    const numbers = new Set(Array.from({ length: 50 }, () => generateCardNumber()))
    expect(numbers.size).toBeGreaterThan(1)
  })
})
