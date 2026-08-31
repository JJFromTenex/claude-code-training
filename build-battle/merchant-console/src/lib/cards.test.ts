import { describe, expect, it } from "vitest"
import {
  generateCardNumber,
  isValidCardTransition,
  isValidLuhn,
  luhnCheckDigit,
} from "./cards"

describe("luhnCheckDigit", () => {
  it("reproduces the known check digit for Stripe's 4242 test number", () => {
    // 4242 4242 4242 4242 is a widely-known valid Luhn number; the last
    // digit is its check digit over the preceding 15.
    expect(luhnCheckDigit("424242424242424")).toBe(2)
  })

  it("returns 0 when the digits already sum to a multiple of 10", () => {
    expect(isValidLuhn("42420" + luhnCheckDigit("42420"))).toBe(true)
  })
})

describe("isValidLuhn", () => {
  it("accepts a genuinely valid number", () => {
    expect(isValidLuhn("4242424242424242")).toBe(true)
  })

  it("rejects a number with a corrupted last digit", () => {
    expect(isValidLuhn("4242424242424241")).toBe(false)
  })

  it("rejects anything that is not all digits", () => {
    expect(isValidLuhn("4242-4242-4242-4242")).toBe(false)
  })
})

describe("generateCardNumber", () => {
  it("always starts with the 4242 test BIN", () => {
    for (let i = 0; i < 50; i++) {
      expect(generateCardNumber().number.startsWith("4242")).toBe(true)
    }
  })

  it("is always 16 digits", () => {
    for (let i = 0; i < 50; i++) {
      expect(generateCardNumber().number).toMatch(/^\d{16}$/)
    }
  })

  it("always carries a valid Luhn check digit", () => {
    for (let i = 0; i < 50; i++) {
      expect(isValidLuhn(generateCardNumber().number)).toBe(true)
    }
  })

  it("returns last4 that matches the tail of the full number", () => {
    const { number, last4 } = generateCardNumber()
    expect(number.endsWith(last4)).toBe(true)
    expect(last4).toHaveLength(4)
  })

  it("is deterministic given a fixed random source, for reproducing a specific case", () => {
    let calls = 0
    const fixed = () => {
      calls++
      return 0.1
    }
    const a = generateCardNumber(fixed)
    calls = 0
    const b = generateCardNumber(fixed)
    expect(a).toEqual(b)
  })
})

describe("isValidCardTransition", () => {
  it("allows active to move to frozen or cancelled", () => {
    expect(isValidCardTransition("active", "frozen")).toBe(true)
    expect(isValidCardTransition("active", "cancelled")).toBe(true)
  })

  it("allows frozen to move to active or cancelled", () => {
    expect(isValidCardTransition("frozen", "active")).toBe(true)
    expect(isValidCardTransition("frozen", "cancelled")).toBe(true)
  })

  it("never lets cancelled move anywhere, including back to itself", () => {
    expect(isValidCardTransition("cancelled", "active")).toBe(false)
    expect(isValidCardTransition("cancelled", "frozen")).toBe(false)
    expect(isValidCardTransition("cancelled", "cancelled")).toBe(false)
  })

  it("rejects a status trying to move to its own state", () => {
    expect(isValidCardTransition("active", "active")).toBe(false)
    expect(isValidCardTransition("frozen", "frozen")).toBe(false)
  })
})
