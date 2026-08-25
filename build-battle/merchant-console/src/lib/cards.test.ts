import { describe, expect, it } from "vitest"
import { CardStatus } from "@/data/types"
import {
  canTransition,
  generateCardNumber,
  isValidLuhn,
  validateCreateCardInput,
  validateStatusUpdate,
} from "./cards"

describe("generateCardNumber", () => {
  it("always starts with the 4242 test BIN and is 16 digits", () => {
    for (let i = 0; i < 1000; i++) {
      const number = generateCardNumber()
      expect(number).toHaveLength(16)
      expect(number.startsWith("4242")).toBe(true)
    }
  })

  it("always carries a valid Luhn check digit", () => {
    for (let i = 0; i < 1000; i++) {
      expect(isValidLuhn(generateCardNumber())).toBe(true)
    }
  })
})

describe("isValidLuhn", () => {
  it("accepts the classic worked example", () => {
    expect(isValidLuhn("79927398713")).toBe(true)
  })

  it("rejects a number with a wrong check digit", () => {
    expect(isValidLuhn("79927398710")).toBe(false)
  })
})

describe("canTransition", () => {
  const STATUSES: CardStatus[] = ["active", "frozen", "cancelled"]
  const LEGAL = new Set(["active>frozen", "frozen>active", "active>cancelled", "frozen>cancelled"])

  for (const from of STATUSES) {
    for (const to of STATUSES) {
      const key = `${from}>${to}`
      const expected = LEGAL.has(key)
      it(`${expected ? "allows" : "rejects"} ${from} -> ${to}`, () => {
        expect(canTransition(from, to)).toBe(expected)
      })
    }
  }
})

describe("validateCreateCardInput", () => {
  const valid = {
    nickname: "Ad spend — Q3",
    merchantId: "mch_01",
    spendLimit: 25000,
    currency: "USD",
  }

  it("accepts a fully valid request", () => {
    const result = validateCreateCardInput(valid)
    expect(result.ok).toBe(true)
  })

  it("rejects a missing nickname", () => {
    const result = validateCreateCardInput({ ...valid, nickname: "  " })
    expect(result).toEqual({ ok: false, error: "Nickname is required." })
  })

  it("rejects a missing or unknown merchant", () => {
    const result = validateCreateCardInput({ ...valid, merchantId: "mch_does_not_exist" })
    expect(result).toEqual({ ok: false, error: "Select a valid merchant." })
  })

  it("rejects a zero spend limit", () => {
    const result = validateCreateCardInput({ ...valid, spendLimit: 0 })
    expect(result).toEqual({
      ok: false,
      error: "Spend limit must be a positive whole number of minor units.",
    })
  })

  it("rejects a negative spend limit", () => {
    const result = validateCreateCardInput({ ...valid, spendLimit: -100 })
    expect(result).toEqual({
      ok: false,
      error: "Spend limit must be a positive whole number of minor units.",
    })
  })

  it("rejects a spend limit above 5,000,000 minor units", () => {
    const result = validateCreateCardInput({ ...valid, spendLimit: 5_000_001 })
    expect(result).toEqual({
      ok: false,
      error: "Spend limit cannot exceed 5,000,000 minor units.",
    })
  })

  it("rejects a currency outside USD, EUR, GBP", () => {
    const result = validateCreateCardInput({ ...valid, currency: "JPY" })
    expect(result).toEqual({ ok: false, error: "Currency must be USD, EUR, or GBP." })
  })

  it("rejects a currency that doesn't match the merchant's own currency", () => {
    // mch_04 (Halcyon Studio) is GBP — see src/data/merchants.ts
    const result = validateCreateCardInput({ ...valid, merchantId: "mch_04", currency: "USD" })
    expect(result).toEqual({
      ok: false,
      error: "Currency must match the merchant's currency (GBP).",
    })
  })

  it("accepts a currency that matches the merchant's own currency", () => {
    const result = validateCreateCardInput({ ...valid, merchantId: "mch_04", currency: "GBP" })
    expect(result.ok).toBe(true)
  })

  it("rejects an unknown category", () => {
    const result = validateCreateCardInput({ ...valid, category: "not-a-category" })
    expect(result).toEqual({ ok: false, error: "Unknown category." })
  })

  it("accepts an omitted category as null", () => {
    const result = validateCreateCardInput(valid)
    expect(result.ok && result.data.category).toBe(null)
  })
})

describe("validateStatusUpdate", () => {
  it("accepts a known status", () => {
    expect(validateStatusUpdate({ status: "frozen" })).toEqual({
      ok: true,
      data: { status: "frozen" },
    })
  })

  it("rejects an unknown status", () => {
    expect(validateStatusUpdate({ status: "suspended" })).toEqual({
      ok: false,
      error: "Status must be active, frozen, or cancelled.",
    })
  })
})
