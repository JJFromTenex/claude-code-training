import { describe, expect, it } from "vitest"
import { Card } from "@/data/types"
import {
  generateCardNumber,
  isValidLuhn,
  luhnCheckDigit,
  maskCardNumber,
  nextCardId,
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

describe("generateCardNumber", () => {
  it("returns sixteen digits on the test BIN", () => {
    const number = generateCardNumber()
    expect(number).toHaveLength(16)
    expect(number.startsWith(TEST_BIN)).toBe(true)
    expect(/^\d{16}$/.test(number)).toBe(true)
  })

  it("is Luhn-valid every time", () => {
    // A generator that is right nine times in ten still ships a bad card, so
    // this asserts across a thousand rather than one.
    for (let i = 0; i < 1000; i++) {
      expect(isValidLuhn(generateCardNumber())).toBe(true)
    }
  })

  it("does not repeat itself", () => {
    expect(generateCardNumber()).not.toBe(generateCardNumber())
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
