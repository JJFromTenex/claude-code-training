import { describe, expect, it } from "vitest"
import { generateCardNumber, getLastFour, isValidLuhn } from "./luhn"

describe("isValidLuhn", () => {
  it("validates a correct Luhn number", () => {
    expect(isValidLuhn("4242424242424242")).toBe(true)
  })

  it("rejects an invalid Luhn number", () => {
    expect(isValidLuhn("4242424242424243")).toBe(false)
  })

  it("handles numbers with spaces and dashes", () => {
    expect(isValidLuhn("4242 4242 4242 4242")).toBe(true)
    expect(isValidLuhn("4242-4242-4242-4242")).toBe(true)
  })

  it("rejects an empty string", () => {
    expect(isValidLuhn("")).toBe(false)
  })
})

describe("generateCardNumber", () => {
  it("generates a 16-digit number", () => {
    const card = generateCardNumber()
    expect(card).toHaveLength(16)
    expect(/^\d+$/.test(card)).toBe(true)
  })

  it("starts with 4242", () => {
    const card = generateCardNumber()
    expect(card.startsWith("424200")).toBe(true)
  })

  it("passes the Luhn check", () => {
    const card = generateCardNumber()
    expect(isValidLuhn(card)).toBe(true)
  })

  it("generates different numbers on each call", () => {
    const card1 = generateCardNumber()
    const card2 = generateCardNumber()
    expect(card1).not.toBe(card2)
  })
})

describe("getLastFour", () => {
  it("extracts the last 4 digits", () => {
    expect(getLastFour("4242424242424242")).toBe("4242")
    expect(getLastFour("4111111111111111")).toBe("1111")
  })
})
