import { describe, expect, it } from "vitest"
import type { CardStatus } from "@/data/types"
import {
  CARD_CURRENCIES,
  CARD_NUMBER_LENGTH,
  MAX_SPEND_LIMIT,
  MIN_SPEND_LIMIT,
  TEST_BIN,
  canTransition,
  generateCardNumber,
  luhnCheck,
  luhnCheckDigit,
  maskLast4,
} from "./cards"

/**
 * Card numbers, the Luhn check, and the status state machine are the parts
 * of this codebase most likely to drift silently. Every fixture here uses
 * the 4242 test BIN; nothing in this file may resemble a real PAN.
 */

const STATUSES: CardStatus[] = ["active", "frozen", "cancelled"]

describe("generateCardNumber", () => {
  it("produces a 16-digit number starting with the test BIN and passing luhnCheck, every time across 1000 runs", () => {
    for (let i = 0; i < 1000; i++) {
      const number = generateCardNumber()
      expect(number).toMatch(/^\d+$/)
      expect(number).toHaveLength(CARD_NUMBER_LENGTH)
      expect(number.startsWith(TEST_BIN)).toBe(true)
      expect(luhnCheck(number)).toBe(true)
    }
  })
})

describe("luhnCheck", () => {
  it("accepts a known-valid test-BIN number", () => {
    // 4242 4242 4242 4242 is the canonical Luhn-valid test PAN.
    expect(luhnCheck("4242424242424242")).toBe(true)
  })

  it("rejects the same number with the last digit altered", () => {
    expect(luhnCheck("4242424242424241")).toBe(false)
  })

  it("rejects a number with two digits transposed", () => {
    // Transposing digits changes the checksum in almost every case.
    expect(luhnCheck("4242424242424224")).toBe(false)
  })

  it("rejects an empty string", () => {
    expect(luhnCheck("")).toBe(false)
  })
})

describe("luhnCheckDigit", () => {
  it("returns the digit that makes a 15-digit test-BIN partial Luhn-valid", () => {
    const partial = "424242424242424".slice(0, 15)
    const digit = luhnCheckDigit(partial)
    expect(digit).toMatch(/^\d$/)
    expect(luhnCheck(partial + digit)).toBe(true)
  })

  it("reproduces the known check digit for 424242424242424", () => {
    // 4242424242424242 is Luhn-valid, so the check digit for the first 15
    // digits must be the published trailing 2.
    expect(luhnCheckDigit("424242424242424")).toBe("2")
  })

  it("is consistent across every 15-digit test-BIN partial", () => {
    for (let i = 0; i < 200; i++) {
      const rest = Array.from({ length: 11 }, () =>
        Math.floor(Math.random() * 10),
      ).join("")
      const partial = TEST_BIN + rest
      expect(partial).toHaveLength(15)
      const digit = luhnCheckDigit(partial)
      expect(luhnCheck(partial + digit)).toBe(true)
    }
  })
})

describe("maskLast4", () => {
  it("renders the exact masked form", () => {
    expect(maskLast4("4242")).toBe("•••• 4242")
  })

  it("uses the given digits verbatim, not the test BIN", () => {
    expect(maskLast4("0007")).toBe("•••• 0007")
  })
})

describe("canTransition", () => {
  const expected: Record<CardStatus, Record<CardStatus, boolean>> = {
    active: { active: false, frozen: true, cancelled: true },
    frozen: { active: true, frozen: false, cancelled: true },
    cancelled: { active: false, frozen: false, cancelled: false },
  }

  for (const from of STATUSES) {
    for (const to of STATUSES) {
      const label =
        from === to
          ? `rejects a transition from ${from} to itself`
          : `${expected[from][to] ? "allows" : "rejects"} ${from} -> ${to}`

      it(label, () => {
        expect(canTransition(from, to)).toBe(expected[from][to])
      })
    }
  }

  it("treats cancelled as a true terminal state: nothing leaves it", () => {
    for (const to of STATUSES) {
      expect(canTransition("cancelled", to)).toBe(false)
    }
  })
})

describe("limit constants", () => {
  it("match the values frozen in the contract", () => {
    expect(MIN_SPEND_LIMIT).toBe(1)
    expect(MAX_SPEND_LIMIT).toBe(5_000_000)
    expect(CARD_CURRENCIES).toEqual(["USD", "EUR", "GBP"])
  })

  it("keeps MIN_SPEND_LIMIT exclusive of zero", () => {
    expect(MIN_SPEND_LIMIT).toBeGreaterThan(0)
  })
})

describe("CARD_NUMBER_LENGTH and TEST_BIN", () => {
  it("are the values the rest of the app depends on", () => {
    expect(CARD_NUMBER_LENGTH).toBe(16)
    expect(TEST_BIN).toBe("4242")
  })
})
