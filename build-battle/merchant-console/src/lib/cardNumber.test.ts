import { describe, expect, it } from "vitest"
import { generateCardNumber, isValidLuhn, luhnCheckDigit, maskCardNumber } from "./cardNumber"

describe("generateCardNumber", () => {
  it("starts with the 4242 test BIN", () => {
    expect(generateCardNumber().startsWith("4242")).toBe(true)
  })

  it("returns a 16-digit string", () => {
    expect(generateCardNumber()).toMatch(/^\d{16}$/)
  })

  it("passes the Luhn checksum", () => {
    expect(isValidLuhn(generateCardNumber())).toBe(true)
  })

  it("always starts 4242 and passes Luhn across many generations", () => {
    for (let i = 0; i < 200; i++) {
      const number = generateCardNumber()
      expect(number.startsWith("4242")).toBe(true)
      expect(isValidLuhn(number)).toBe(true)
    }
  })
})

describe("luhnCheckDigit", () => {
  it("computes a digit that makes the full number pass Luhn", () => {
    const partial = "424212345678901"
    const digit = luhnCheckDigit(partial)
    expect(isValidLuhn(partial + digit)).toBe(true)
  })
})

describe("isValidLuhn", () => {
  it("rejects a number with a wrong check digit", () => {
    const partial = "424212345678901"
    const correct = Number(luhnCheckDigit(partial))
    const wrong = String((correct + 1) % 10)
    expect(isValidLuhn(partial + wrong)).toBe(false)
  })
})

describe("maskCardNumber", () => {
  it("formats as bullets followed by the last four", () => {
    expect(maskCardNumber("1234")).toBe("•••• 1234")
  })
})
