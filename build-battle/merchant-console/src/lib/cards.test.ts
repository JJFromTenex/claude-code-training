import { describe, expect, it } from "vitest"
import {
  CARD_BIN,
  CARD_NUMBER_LENGTH,
  CARD_TRANSITIONS,
  canTransition,
  generateCardNumber,
  isNearLimit,
  isValidLuhn,
  luhnCheckDigit,
  maskCardNumber,
} from "./cards"
import { CardStatus } from "@/data/types"

/**
 * Generated numbers must never resemble a real PAN, so every test here stays
 * on the 4242 test BIN. Reveal-once and server-side generation are enforced
 * by the type and the route, not by anything unit-testable — this file
 * covers the math underneath them: Luhn, the transition table, and the
 * spend-limit threshold.
 */

describe("luhnCheckDigit", () => {
  it("matches a hand-checked case: 424242424242424 -> 2", () => {
    // 4242424242424242 is the well-known Luhn-valid test PAN. Dropping its
    // check digit and recomputing should reproduce it.
    expect(luhnCheckDigit("424242424242424")).toBe(2)
  })
})

describe("generateCardNumber", () => {
  const numbers = Array.from({ length: 200 }, () => generateCardNumber())

  it("is always 16 digits", () => {
    for (const number of numbers) {
      expect(number).toHaveLength(CARD_NUMBER_LENGTH)
      expect(number).toMatch(/^\d{16}$/)
    }
  })

  it("always starts with the 4242 test BIN", () => {
    for (const number of numbers) {
      expect(number.startsWith(CARD_BIN)).toBe(true)
    }
  })

  it("always satisfies Luhn", () => {
    for (const number of numbers) {
      expect(isValidLuhn(number)).toBe(true)
    }
  })
})

describe("isValidLuhn", () => {
  it("rejects a tampered digit", () => {
    const number = generateCardNumber()
    const tamperedDigit = (Number(number[5]) + 1) % 10
    const tampered =
      number.slice(0, 5) + String(tamperedDigit) + number.slice(6)

    expect(isValidLuhn(tampered)).toBe(false)
  })
})

describe("maskCardNumber", () => {
  it("shows only the last four digits", () => {
    expect(maskCardNumber("4242")).toBe("•••• 4242")
  })
})

describe("CARD_TRANSITIONS / canTransition", () => {
  const ALL_STATUSES: CardStatus[] = ["active", "frozen", "cancelled"]

  it("matches the fixed table for every from/to combination", () => {
    for (const from of ALL_STATUSES) {
      for (const to of ALL_STATUSES) {
        expect(canTransition(from, to)).toBe(
          CARD_TRANSITIONS[from].includes(to),
        )
      }
    }
  })

  it("allows every legal transition", () => {
    expect(canTransition("active", "frozen")).toBe(true)
    expect(canTransition("active", "cancelled")).toBe(true)
    expect(canTransition("frozen", "active")).toBe(true)
    expect(canTransition("frozen", "cancelled")).toBe(true)
  })

  it("rejects a no-op transition", () => {
    expect(canTransition("active", "active")).toBe(false)
    expect(canTransition("frozen", "frozen")).toBe(false)
    expect(canTransition("cancelled", "cancelled")).toBe(false)
  })

  it("treats cancelled as terminal: nothing comes back from it", () => {
    expect(canTransition("cancelled", "active")).toBe(false)
    expect(canTransition("cancelled", "frozen")).toBe(false)
  })
})

describe("isNearLimit", () => {
  it("is false just under the 80% threshold", () => {
    expect(isNearLimit(7900, 10000)).toBe(false)
  })

  it("is true exactly at the 80% threshold", () => {
    expect(isNearLimit(8000, 10000)).toBe(true)
  })

  it("is true just over the 80% threshold", () => {
    expect(isNearLimit(8100, 10000)).toBe(true)
  })
})
