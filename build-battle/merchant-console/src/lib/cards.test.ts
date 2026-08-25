import { describe, expect, it } from "vitest"
import {
  CARD_TRANSITIONS,
  canTransition,
  generateCardNumber,
  isValidLuhn,
  luhnCheckDigit,
  maskCardNumber,
  TEST_BIN,
} from "./cards"
import { CardStatus } from "@/data/types"

/**
 * A card number that fails Luhn is rejected by every downstream system, and a
 * number off the test BIN would mean this repository contains something that
 * looks like a real PAN. Both are pinned here. Every fixture is a 4242 number.
 */

describe("generateCardNumber", () => {
  it("issues 16 digits on the test BIN", () => {
    for (let i = 0; i < 50; i++) {
      const number = generateCardNumber()
      expect(number).toMatch(/^\d{16}$/)
      expect(number.startsWith(TEST_BIN)).toBe(true)
    }
  })

  it("issues numbers that satisfy Luhn", () => {
    for (let i = 0; i < 50; i++) {
      expect(isValidLuhn(generateCardNumber())).toBe(true)
    }
  })

  it("does not issue the same number twice in a row", () => {
    const issued = new Set(Array.from({ length: 50 }, generateCardNumber))
    expect(issued.size).toBeGreaterThan(1)
  })
})

describe("luhnCheckDigit", () => {
  it("completes a payload into a valid number", () => {
    const payload = "424212345678901"
    expect(isValidLuhn(`${payload}${luhnCheckDigit(payload)}`)).toBe(true)
  })

  it("returns a single digit", () => {
    expect(luhnCheckDigit("424200000000000")).toMatch(/^\d$/)
  })
})

describe("isValidLuhn", () => {
  it("rejects a number with a tampered digit", () => {
    const number = generateCardNumber()
    const lastDigit = Number(number[15])
    const tampered = `${number.slice(0, 15)}${(lastDigit + 1) % 10}`
    expect(isValidLuhn(tampered)).toBe(false)
  })

  it("rejects anything that is not all digits", () => {
    expect(isValidLuhn("4242-1234-5678-9015")).toBe(false)
    expect(isValidLuhn("")).toBe(false)
  })
})

describe("maskCardNumber", () => {
  it("writes the last four behind dots", () => {
    expect(maskCardNumber("9015")).toBe("•••• 9015")
  })
})

describe("canTransition", () => {
  it("moves a card between active and frozen in both directions", () => {
    expect(canTransition("active", "frozen")).toBe(true)
    expect(canTransition("frozen", "active")).toBe(true)
  })

  it("cancels from either live status", () => {
    expect(canTransition("active", "cancelled")).toBe(true)
    expect(canTransition("frozen", "cancelled")).toBe(true)
  })

  it("treats cancelled as terminal", () => {
    const statuses: CardStatus[] = ["active", "frozen", "cancelled"]
    for (const to of statuses) {
      expect(canTransition("cancelled", to)).toBe(false)
    }
    expect(CARD_TRANSITIONS.cancelled).toHaveLength(0)
  })

  it("rejects a transition to the status a card already has", () => {
    expect(canTransition("active", "active")).toBe(false)
    expect(canTransition("frozen", "frozen")).toBe(false)
  })
})
