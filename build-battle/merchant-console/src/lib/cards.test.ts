import { describe, expect, it } from "vitest"
import { merchants } from "@/data/merchants"
import {
  MAX_LIMIT_MINOR_UNITS,
  generateCardNumber,
  isValidLuhn,
  maskCardNumber,
  validateIssueCardInput,
} from "./cards"

describe("generateCardNumber", () => {
  it("starts on the 4242 test BIN", () => {
    expect(generateCardNumber().startsWith("4242")).toBe(true)
  })

  it("is 16 digits", () => {
    expect(generateCardNumber()).toMatch(/^\d{16}$/)
  })

  it("always carries a valid Luhn check digit", () => {
    for (let i = 0; i < 50; i++) {
      expect(isValidLuhn(generateCardNumber())).toBe(true)
    }
  })

  it("varies between calls", () => {
    const numbers = new Set(Array.from({ length: 20 }, () => generateCardNumber()))
    expect(numbers.size).toBeGreaterThan(1)
  })
})

describe("isValidLuhn", () => {
  it("accepts the well-known 4242 4242 4242 4242 test PAN", () => {
    expect(isValidLuhn("4242424242424242")).toBe(true)
  })

  it("rejects a tampered check digit", () => {
    const pan = generateCardNumber()
    const wrongDigit = String((Number(pan.at(-1)) + 1) % 10)
    expect(isValidLuhn(pan.slice(0, -1) + wrongDigit)).toBe(false)
  })
})

describe("maskCardNumber", () => {
  it("shows the real last four, not the BIN", () => {
    expect(maskCardNumber("1234")).toBe("•••• 1234")
  })
})

describe("validateIssueCardInput", () => {
  const merchantId = merchants[0].id
  const valid = { nickname: "Ad spend", merchantId, limitMinorUnits: 25000, currency: "USD" }

  it("accepts a valid input", () => {
    expect(validateIssueCardInput(valid).valid).toBe(true)
  })

  it("rejects a missing nickname", () => {
    expect(validateIssueCardInput({ ...valid, nickname: "" }).valid).toBe(false)
  })

  it("rejects a missing or unknown merchant", () => {
    expect(validateIssueCardInput({ ...valid, merchantId: "" }).valid).toBe(false)
    expect(validateIssueCardInput({ ...valid, merchantId: "mch_missing" }).valid).toBe(false)
  })

  it("rejects a zero limit", () => {
    expect(validateIssueCardInput({ ...valid, limitMinorUnits: 0 }).valid).toBe(false)
  })

  it("rejects a negative limit", () => {
    expect(validateIssueCardInput({ ...valid, limitMinorUnits: -500 }).valid).toBe(false)
  })

  it("rejects a limit above 5,000,000 minor units", () => {
    expect(
      validateIssueCardInput({ ...valid, limitMinorUnits: MAX_LIMIT_MINOR_UNITS + 1 }).valid,
    ).toBe(false)
  })

  it("accepts a limit exactly at the ceiling", () => {
    expect(
      validateIssueCardInput({ ...valid, limitMinorUnits: MAX_LIMIT_MINOR_UNITS }).valid,
    ).toBe(true)
  })

  it("rejects a currency outside USD/EUR/GBP", () => {
    expect(validateIssueCardInput({ ...valid, currency: "JPY" }).valid).toBe(false)
  })
})
