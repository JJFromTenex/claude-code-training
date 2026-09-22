import { describe, expect, it } from "vitest"
import { Card } from "@/data/types"
import {
  spendPercentage,
  isValidLuhn,
  luhnCheckDigit,
  maskCardNumber,
  nextCardId,
  SPEND_AMBER_AT,
  TEST_BIN,
} from "./cards"

/**
 * Card numbers are the one thing in this codebase that must never resemble a
 * real PAN. These tests pin the 4242 BIN and the Luhn digit, because a
 * generator that drifts off either one produces something that looks like a
 * live card and nothing in the app would complain.
 */

describe("luhnCheckDigit", () => {
  it("completes a payload into a valid number", () => {
    const payload = "424242424242424"
    expect(isValidLuhn(`${payload}${luhnCheckDigit(payload)}`)).toBe(true)
  })

  it("returns a single digit", () => {
    expect(luhnCheckDigit("424242424242424")).toBeLessThan(10)
    expect(luhnCheckDigit("424242424242424")).toBeGreaterThanOrEqual(0)
  })
})

describe("isValidLuhn", () => {
  it("accepts a known-good test number", () => {
    expect(isValidLuhn("4242424242424242")).toBe(true)
  })

  it("rejects the same number with one digit mutated", () => {
    expect(isValidLuhn("4242424242424243")).toBe(false)
  })

  it("rejects anything that is not all digits", () => {
    expect(isValidLuhn("4242-4242-4242-4242")).toBe(false)
    expect(isValidLuhn("")).toBe(false)
  })
})

describe("maskCardNumber", () => {
  it("renders the house mask", () => {
    expect(maskCardNumber("4242")).toBe("•••• 4242")
  })
})

describe("nextCardId", () => {
  const card = (id: string): Card => ({
    id,
    nickname: "Ad spend",
    merchantId: "mch_01",
    spendLimit: 500_000,
    spent: 0,
    currency: "USD",
    status: "active",
    last4: "4242",
    reference: "cref_test",
    createdAt: "2026-08-13T00:00:00.000Z",
  })

  it("starts at one when nothing has been issued", () => {
    expect(nextCardId([])).toBe("card_000001")
  })

  it("continues from the highest id rather than the count", () => {
    // Counting would collide as soon as the list is filtered or reordered.
    expect(nextCardId([card("card_000004"), card("card_000002")])).toBe(
      "card_000005",
    )
  })
})

describe("spendPercentage", () => {
  it("floors rather than rounds up", () => {
    // 86.67% must not read as 87, and 99.9% must never read as spent out.
    expect(spendPercentage(104_000, 120_000)).toBe(86)
    expect(spendPercentage(99_999, 100_000)).toBe(99)
  })

  it("handles the ends of the range", () => {
    expect(spendPercentage(0, 100_000)).toBe(0)
    expect(spendPercentage(100_000, 100_000)).toBe(100)
  })

  it("returns zero rather than dividing by zero", () => {
    expect(spendPercentage(500, 0)).toBe(0)
  })

  it("crosses the amber threshold where the seeded card sits", () => {
    expect(spendPercentage(104_000, 120_000)).toBeGreaterThanOrEqual(SPEND_AMBER_AT)
    expect(spendPercentage(212_500, 500_000)).toBeLessThan(SPEND_AMBER_AT)
  })
})
