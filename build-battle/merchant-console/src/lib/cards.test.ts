import { describe, expect, it } from "vitest"
import { CardStatus } from "@/data/types"
import {
  CARD_STATUSES,
  TEST_BIN,
  canTransition,
  generateCardNumber,
  isValidLuhn,
  lastFour,
  luhnCheckDigit,
  maskCardNumber,
} from "./cards"

/**
 * Card numbers are the one thing here that must never look real, and the
 * status machine is the one thing a UI cannot be trusted to enforce. Every
 * number in this file is on the 4242 test BIN.
 */

/** Deterministic stand-in for Math.random, cycling a fixed digit sequence. */
function fixedRandom(digits: number[]): () => number {
  let i = 0
  return () => digits[i++ % digits.length] / 10
}

describe("luhnCheckDigit", () => {
  it("produces the check digit of the canonical test number", () => {
    expect(luhnCheckDigit("424242424242424")).toBe(2)
  })

  it("agrees with isValidLuhn for every single-digit candidate", () => {
    const partial = "424242424242424"
    const correct = luhnCheckDigit(partial)
    for (let digit = 0; digit <= 9; digit++) {
      expect(isValidLuhn(`${partial}${digit}`)).toBe(digit === correct)
    }
  })
})

describe("isValidLuhn", () => {
  it("accepts a valid test number and rejects a transposed one", () => {
    expect(isValidLuhn("4242424242424242")).toBe(true)
    expect(isValidLuhn("4242424242424243")).toBe(false)
  })

  it("rejects anything that is not all digits", () => {
    expect(isValidLuhn("4242-4242-4242-4242")).toBe(false)
    expect(isValidLuhn("")).toBe(false)
    expect(isValidLuhn("4")).toBe(false)
  })
})

describe("generateCardNumber", () => {
  it("is 16 digits on the test BIN with a valid check digit", () => {
    const number = generateCardNumber(fixedRandom([7]))
    expect(number).toHaveLength(16)
    expect(number.startsWith(TEST_BIN)).toBe(true)
    expect(isValidLuhn(number)).toBe(true)
  })

  it("holds for many different draws, not just one", () => {
    for (let seed = 0; seed < 40; seed++) {
      const number = generateCardNumber(fixedRandom([seed % 10, (seed + 3) % 10, (seed + 7) % 10]))
      expect(number).toMatch(/^4242\d{12}$/)
      expect(isValidLuhn(number)).toBe(true)
    }
  })

  it("is deterministic for a given random source", () => {
    expect(generateCardNumber(fixedRandom([1, 2, 3]))).toBe(
      generateCardNumber(fixedRandom([1, 2, 3])),
    )
  })
})

describe("masking", () => {
  it("takes the last four and renders the only allowed shape", () => {
    const number = generateCardNumber(fixedRandom([5]))
    expect(lastFour(number)).toHaveLength(4)
    expect(maskCardNumber(lastFour(number))).toBe(`•••• ${lastFour(number)}`)
  })
})

describe("canTransition", () => {
  const legal: [CardStatus, CardStatus][] = [
    ["active", "frozen"],
    ["frozen", "active"],
    ["active", "cancelled"],
    ["frozen", "cancelled"],
  ]

  it("allows exactly the four legal moves", () => {
    for (const [from, to] of legal) {
      expect(canTransition(from, to)).toBe(true)
    }
  })

  it("rejects every other pair, including staying put", () => {
    const isLegal = (from: CardStatus, to: CardStatus) =>
      legal.some(([f, t]) => f === from && t === to)

    for (const from of CARD_STATUSES) {
      for (const to of CARD_STATUSES) {
        if (isLegal(from, to)) continue
        expect(canTransition(from, to), `${from} -> ${to}`).toBe(false)
      }
    }
  })

  it("treats cancelled as terminal", () => {
    expect(canTransition("cancelled", "active")).toBe(false)
    expect(canTransition("cancelled", "frozen")).toBe(false)
    expect(canTransition("cancelled", "cancelled")).toBe(false)
  })
})
