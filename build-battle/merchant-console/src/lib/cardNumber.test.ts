import { describe, expect, it } from "vitest"
import {
  generateTestCardNumber,
  isValidLuhn,
  luhnCheckDigit,
} from "./cardNumber"

describe("luhnCheckDigit", () => {
  it("matches published test numbers", () => {
    expect(luhnCheckDigit("424242424242424")).toBe("2")
    expect(luhnCheckDigit("7992739871")).toBe("3")
  })

  it("returns 0 when the sum is already a multiple of ten", () => {
    expect(luhnCheckDigit("424200000000000")).toBe("0")
  })
})

describe("isValidLuhn", () => {
  it("accepts a correct check digit", () => {
    expect(isValidLuhn("4242424242424242")).toBe(true)
    expect(isValidLuhn("79927398713")).toBe(true)
  })

  it("rejects a single-digit change anywhere in the number", () => {
    const valid = "4242424242424242"
    for (let i = 0; i < valid.length; i++) {
      const changed = String((Number(valid[i]) + 1) % 10)
      const mutated = valid.slice(0, i) + changed + valid.slice(i + 1)
      expect(isValidLuhn(mutated)).toBe(false)
    }
  })

  it("rejects anything that is not all digits", () => {
    expect(isValidLuhn("4242 4242 4242 4242")).toBe(false)
    expect(isValidLuhn("")).toBe(false)
  })
})

describe("generateTestCardNumber", () => {
  it("is 16 digits on the 4242 BIN with a valid check digit, every time", () => {
    for (let i = 0; i < 500; i++) {
      const number = generateTestCardNumber()
      expect(number).toMatch(/^4242\d{12}$/)
      expect(isValidLuhn(number)).toBe(true)
    }
  })

  it("fills the body from the digit source and appends the check digit", () => {
    expect(generateTestCardNumber(() => 0)).toBe("4242000000000000")
    expect(generateTestCardNumber(() => 1)).toBe("4242111111111113")
  })

  it("does not hand out the same number twice in a row", () => {
    expect(generateTestCardNumber()).not.toBe(generateTestCardNumber())
  })
})
