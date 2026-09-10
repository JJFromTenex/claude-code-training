import { describe, expect, it } from "vitest"
import { CardStatus } from "@/data/types"
import {
  CARD_STATUSES,
  TEST_BIN,
  canTransition,
  generateCardNumber,
  isLuhnValid,
  lastFour,
  luhnCheckDigit,
  maskLast4,
} from "./cards"

/**
 * Two things here are worth a test rather than a code read. A generator that
 * drifts off the 4242 BIN puts something PAN-shaped in the repository, and a
 * state machine that leaks one illegal edge brings a cancelled card back to
 * life. Both are cheap to assert and expensive to discover in review.
 */

describe("luhnCheckDigit", () => {
  it("produces the digit that makes the whole number check out", () => {
    // 4242424242424242 is the canonical test PAN: payload 424242424242424,
    // check digit 2.
    expect(luhnCheckDigit("424242424242424")).toBe(2)
  })
})

describe("isLuhnValid", () => {
  it("accepts a number carrying the check digit its payload implies", () => {
    expect(isLuhnValid("4242424242424242")).toBe(true)
  })

  it("rejects a number with a tampered digit", () => {
    expect(isLuhnValid("4242424242424243")).toBe(false)
  })

  it("rejects anything that is not all digits", () => {
    expect(isLuhnValid("4242-4242-4242-4242")).toBe(false)
    expect(isLuhnValid("")).toBe(false)
  })
})

describe("generateCardNumber", () => {
  const numbers = Array.from({ length: 500 }, () => generateCardNumber())

  it("always starts on the test BIN", () => {
    for (const number of numbers) {
      expect(number.startsWith(TEST_BIN)).toBe(true)
    }
  })

  it("always produces sixteen digits", () => {
    for (const number of numbers) {
      expect(number).toMatch(/^\d{16}$/)
    }
  })

  it("always carries a valid Luhn check digit", () => {
    for (const number of numbers) {
      expect(isLuhnValid(number)).toBe(true)
    }
  })

  it("is deterministic when handed a deterministic source", () => {
    const fixed = () => 0.5
    expect(generateCardNumber(fixed)).toBe(generateCardNumber(fixed))
  })

  it("stays valid at the extremes of its random source", () => {
    expect(isLuhnValid(generateCardNumber(() => 0))).toBe(true)
    expect(isLuhnValid(generateCardNumber(() => 0.999999))).toBe(true)
  })
})

describe("lastFour and maskLast4", () => {
  it("keeps only the last four digits", () => {
    expect(lastFour("4242424242429876")).toBe("9876")
  })

  it("masks with the same bullets the payments table uses", () => {
    expect(maskLast4("4242")).toBe("•••• 4242")
  })
})

describe("canTransition", () => {
  it("allows a card to be frozen and thawed", () => {
    expect(canTransition("active", "frozen")).toBe(true)
    expect(canTransition("frozen", "active")).toBe(true)
  })

  it("allows either live status to be cancelled", () => {
    expect(canTransition("active", "cancelled")).toBe(true)
    expect(canTransition("frozen", "cancelled")).toBe(true)
  })

  it("treats cancelled as terminal", () => {
    for (const status of CARD_STATUSES) {
      expect(canTransition("cancelled", status)).toBe(false)
    }
  })

  it("refuses to re-apply a status the card already holds", () => {
    for (const status of CARD_STATUSES) {
      expect(canTransition(status, status)).toBe(false)
    }
  })

  it("permits exactly four edges across the whole machine", () => {
    const legal: [CardStatus, CardStatus][] = []
    for (const from of CARD_STATUSES) {
      for (const to of CARD_STATUSES) {
        if (canTransition(from, to)) legal.push([from, to])
      }
    }
    expect(legal).toEqual([
      ["active", "frozen"],
      ["active", "cancelled"],
      ["frozen", "active"],
      ["frozen", "cancelled"],
    ])
  })
})
