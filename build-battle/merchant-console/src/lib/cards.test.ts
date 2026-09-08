import { describe, expect, it } from "vitest"
import {
  CARD_CATEGORIES,
  canTransition,
  generateCardNumber,
  isValidLuhn,
} from "./cards"

describe("isValidLuhn", () => {
  it("accepts a known-good test number", () => {
    // 4242 4242 4242 4242 is the canonical test PAN and passes Luhn.
    expect(isValidLuhn("4242424242424242")).toBe(true)
  })

  it("rejects a number with a bad check digit", () => {
    expect(isValidLuhn("4242424242424241")).toBe(false)
  })

  it("rejects empty and non-digit input", () => {
    expect(isValidLuhn("")).toBe(false)
    expect(isValidLuhn("4242-4242")).toBe(false)
  })
})

describe("generateCardNumber", () => {
  it("emits 16 digits on the 4242 BIN with a valid Luhn check, every time", () => {
    for (let i = 0; i < 100; i++) {
      const number = generateCardNumber()
      expect(number).toHaveLength(16)
      expect(number.startsWith("4242")).toBe(true)
      expect(isValidLuhn(number)).toBe(true)
    }
  })
})

describe("canTransition", () => {
  it("allows active ⇄ frozen", () => {
    expect(canTransition("active", "frozen")).toBe(true)
    expect(canTransition("frozen", "active")).toBe(true)
  })

  it("allows either to cancelled", () => {
    expect(canTransition("active", "cancelled")).toBe(true)
    expect(canTransition("frozen", "cancelled")).toBe(true)
  })

  it("treats cancelled as terminal", () => {
    expect(canTransition("cancelled", "active")).toBe(false)
    expect(canTransition("cancelled", "frozen")).toBe(false)
    expect(canTransition("cancelled", "cancelled")).toBe(false)
  })

  it("rejects a no-op transition to the same status", () => {
    expect(canTransition("active", "active")).toBe(false)
    expect(canTransition("frozen", "frozen")).toBe(false)
  })
})

describe("CARD_CATEGORIES", () => {
  it("lists the four categories the console offers at issue time", () => {
    expect(CARD_CATEGORIES).toEqual([
      "retail",
      "marketplace",
      "subscription",
      "services",
    ])
  })
})
