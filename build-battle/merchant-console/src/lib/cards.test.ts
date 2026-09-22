import { describe, expect, it } from "vitest"
import { generateCardNumber, last4FromNumber, luhnValid } from "./cards"

describe("generateCardNumber", () => {
  it("produces a 16-digit string", () => {
    expect(generateCardNumber()).toHaveLength(16)
    expect(/^\d{16}$/.test(generateCardNumber())).toBe(true)
  })

  it("always starts with the 4242 test BIN", () => {
    for (let i = 0; i < 20; i++) {
      expect(generateCardNumber().startsWith("4242")).toBe(true)
    }
  })

  it("passes the Luhn check", () => {
    for (let i = 0; i < 20; i++) {
      expect(luhnValid(generateCardNumber())).toBe(true)
    }
  })

  it("produces different numbers on successive calls", () => {
    const numbers = new Set(Array.from({ length: 20 }, generateCardNumber))
    expect(numbers.size).toBeGreaterThan(1)
  })
})

describe("last4FromNumber", () => {
  it("returns the last four digits", () => {
    expect(last4FromNumber("4242123456784242")).toBe("4242")
    expect(last4FromNumber("4242000000001234")).toBe("1234")
  })
})

describe("luhnValid", () => {
  it("accepts a known-valid number", () => {
    expect(luhnValid("4242424242424242")).toBe(true)
  })

  it("rejects a number with a wrong check digit", () => {
    expect(luhnValid("4242424242424241")).toBe(false)
  })
})
