import { describe, expect, it } from "vitest"
import { CardStatus } from "@/data/types"
import {
  CARD_STATUSES,
  TEST_BIN,
  allowedTransitions,
  canTransition,
  generateCardNumber,
  isValidLuhn,
  lastFourOf,
  luhnCheckDigit,
  maskedNumber,
} from "./cards"

/**
 * A wrong check digit or a leaked PAN is not a cosmetic bug in an issuing tool,
 * so the BIN, the Luhn digit, and the status machine are all pinned here.
 */

/** Deterministic PRNG, so a failure reproduces instead of appearing once a week. */
function seeded(seed: number) {
  let a = seed
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

describe("luhnCheckDigit", () => {
  it("computes the digit that completes a known-good number", () => {
    // 4242424242424242 is the canonical test card: body + 2 satisfies Luhn.
    expect(luhnCheckDigit("424242424242424")).toBe(2)
  })

  it("returns a single digit for any body", () => {
    const random = seeded(7)
    for (let i = 0; i < 200; i++) {
      const body = generateCardNumber(random).slice(0, -1)
      const digit = luhnCheckDigit(body)
      expect(digit).toBeGreaterThanOrEqual(0)
      expect(digit).toBeLessThanOrEqual(9)
    }
  })
})

describe("isValidLuhn", () => {
  it("accepts the canonical test number", () => {
    expect(isValidLuhn("4242424242424242")).toBe(true)
  })

  it("rejects a number with a tampered digit", () => {
    expect(isValidLuhn("4242424242424243")).toBe(false)
  })

  it("rejects anything that is not all digits", () => {
    expect(isValidLuhn("4242-4242-4242-4242")).toBe(false)
    expect(isValidLuhn("")).toBe(false)
  })
})

describe("generateCardNumber", () => {
  it("always starts with the 4242 test BIN and is 16 digits", () => {
    const random = seeded(42)
    for (let i = 0; i < 500; i++) {
      const number = generateCardNumber(random)
      expect(number.startsWith(TEST_BIN)).toBe(true)
      expect(number).toHaveLength(16)
      expect(number).toMatch(/^\d{16}$/)
    }
  })

  it("always carries a valid Luhn check digit", () => {
    const random = seeded(1234)
    for (let i = 0; i < 500; i++) {
      expect(isValidLuhn(generateCardNumber(random))).toBe(true)
    }
  })

  it("does not return the same number twice in a row", () => {
    const random = seeded(99)
    const first = generateCardNumber(random)
    const second = generateCardNumber(random)
    expect(first).not.toBe(second)
  })
})

describe("lastFourOf and maskedNumber", () => {
  it("keeps only the last four of a number", () => {
    expect(lastFourOf("4242424242424242")).toBe("4242")
  })

  it("masks a card as bullets plus the last four", () => {
    expect(maskedNumber("4242")).toBe("•••• 4242")
  })

  it("never reveals more than four digits", () => {
    const number = "4242987612345678"
    expect(maskedNumber(lastFourOf(number))).not.toContain("9876")
  })
})

describe("card status machine", () => {
  it("allows active and frozen to swap in both directions", () => {
    expect(canTransition("active", "frozen")).toBe(true)
    expect(canTransition("frozen", "active")).toBe(true)
  })

  it("allows either live status to be cancelled", () => {
    expect(canTransition("active", "cancelled")).toBe(true)
    expect(canTransition("frozen", "cancelled")).toBe(true)
  })

  it("treats cancelled as terminal — nothing comes back from it", () => {
    for (const to of CARD_STATUSES) {
      expect(canTransition("cancelled", to)).toBe(false)
    }
    expect(allowedTransitions("cancelled")).toEqual([])
  })

  it("refuses a transition to the status a card is already in", () => {
    expect(canTransition("active", "active")).toBe(false)
    expect(canTransition("frozen", "frozen")).toBe(false)
  })

  it("refuses a status that is not a card status at all", () => {
    expect(canTransition("active", "expired" as CardStatus)).toBe(false)
    expect(canTransition("nonsense" as CardStatus, "active")).toBe(false)
  })
})
