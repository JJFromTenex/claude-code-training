import { describe, expect, it } from "vitest"
import {
  generateCardNumber,
  last4Of,
  luhnCheckDigit,
  luhnIsValid,
  maskedNumber,
} from "./luhn"

describe("luhnCheckDigit", () => {
  it("computes a check digit that makes the number Luhn-valid", () => {
    const body = "424242424242424"
    const check = luhnCheckDigit(body)
    expect(luhnIsValid(body + check)).toBe(true)
  })
})

describe("luhnIsValid", () => {
  it("accepts a valid number", () => {
    expect(luhnIsValid("4242424242424242")).toBe(true)
  })

  it("rejects an invalid number", () => {
    expect(luhnIsValid("4242424242424241")).toBe(false)
  })

  it("rejects non-digit input", () => {
    expect(luhnIsValid("4242-4242-4242-4242")).toBe(false)
  })
})

describe("generateCardNumber", () => {
  it("starts with the 4242 test BIN", () => {
    for (let i = 0; i < 20; i++) {
      expect(generateCardNumber().startsWith("4242")).toBe(true)
    }
  })

  it("is 16 digits", () => {
    expect(generateCardNumber()).toHaveLength(16)
  })

  it("always passes the Luhn check", () => {
    for (let i = 0; i < 50; i++) {
      expect(luhnIsValid(generateCardNumber())).toBe(true)
    }
  })
})

describe("last4Of / maskedNumber", () => {
  it("extracts the last four digits", () => {
    expect(last4Of("4242424242424242")).toBe("4242")
  })

  it("masks everything but the last four", () => {
    expect(maskedNumber("4242")).toBe("•••• 4242")
  })
})
