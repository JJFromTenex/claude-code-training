import { describe, expect, it } from "vitest"
import {
  generateCardNumber,
  isLuhnValid,
  isValidStatusTransition,
  last4Of,
  luhnCheckDigit,
  maskCardNumber,
} from "./cards"

describe("generateCardNumber", () => {
  it("always starts on the 4242 test BIN, is 16 digits, and passes Luhn", () => {
    for (let i = 0; i < 1000; i++) {
      const number = generateCardNumber()
      expect(number).toMatch(/^4242\d{12}$/)
      expect(number).toHaveLength(16)
      expect(isLuhnValid(number)).toBe(true)
    }
  })
})

describe("luhnCheckDigit / isLuhnValid", () => {
  it("computes the known check digit for the canonical Stripe test number", () => {
    expect(luhnCheckDigit("424242424242424")).toBe("2")
    expect(isLuhnValid("4242424242424242")).toBe(true)
  })

  it("rejects a number with a wrong check digit", () => {
    expect(isLuhnValid("4242424242424241")).toBe(false)
  })
})

describe("last4Of / maskCardNumber", () => {
  it("extracts the last four digits and masks with them", () => {
    const last4 = last4Of("4242424242424242")
    expect(last4).toBe("4242")
    expect(maskCardNumber(last4)).toBe("•••• 4242")
  })
})

describe("isValidStatusTransition", () => {
  it("allows active <-> frozen", () => {
    expect(isValidStatusTransition("active", "frozen")).toBe(true)
    expect(isValidStatusTransition("frozen", "active")).toBe(true)
  })

  it("allows either active or frozen to cancel", () => {
    expect(isValidStatusTransition("active", "cancelled")).toBe(true)
    expect(isValidStatusTransition("frozen", "cancelled")).toBe(true)
  })

  it("treats cancelled as terminal", () => {
    expect(isValidStatusTransition("cancelled", "active")).toBe(false)
    expect(isValidStatusTransition("cancelled", "frozen")).toBe(false)
    expect(isValidStatusTransition("cancelled", "cancelled")).toBe(false)
  })

  it("rejects a no-op transition to the same status", () => {
    expect(isValidStatusTransition("active", "active")).toBe(false)
    expect(isValidStatusTransition("frozen", "frozen")).toBe(false)
  })
})
