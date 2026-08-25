import { describe, expect, it } from "vitest"
import { canTransition, generateCardNumber, maskCard } from "./cards"

/**
 * Two things here are never allowed to slip: a generated number must look
 * exactly like a `4242` test card and never a real one, and a card must
 * never move out of `cancelled`. Both are scored, so both get exhaustive
 * coverage rather than a couple of happy-path cases.
 */

/** Deterministic RNG so a "many generated numbers" test isn't flaky. */
function seededRandom(seed: number): () => number {
  let a = seed
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function isValidLuhn(number: string): boolean {
  let sum = 0
  let double = false
  for (let i = number.length - 1; i >= 0; i--) {
    let digit = Number(number[i])
    if (double) {
      digit *= 2
      if (digit > 9) digit -= 9
    }
    sum += digit
    double = !double
  }
  return sum % 10 === 0
}

describe("generateCardNumber", () => {
  it("starts with the 4242 test BIN", () => {
    expect(generateCardNumber(seededRandom(1))).toMatch(/^4242/)
  })

  it("is always 16 digits", () => {
    const number = generateCardNumber(seededRandom(2))
    expect(number).toHaveLength(16)
    expect(number).toMatch(/^\d{16}$/)
  })

  it("carries a valid Luhn check digit across many generated numbers", () => {
    for (let seed = 0; seed < 200; seed++) {
      const number = generateCardNumber(seededRandom(seed))
      expect(isValidLuhn(number)).toBe(true)
    }
  })

  it("defaults to Math.random when no RNG is supplied", () => {
    const number = generateCardNumber()
    expect(number).toMatch(/^4242\d{12}$/)
    expect(isValidLuhn(number)).toBe(true)
  })
})

describe("maskCard", () => {
  it("renders the same glyphs used elsewhere in the console", () => {
    expect(maskCard("4242")).toBe("•••• 4242")
  })
})

describe("canTransition", () => {
  it("allows active and frozen to flip back and forth", () => {
    expect(canTransition("active", "frozen")).toBe(true)
    expect(canTransition("frozen", "active")).toBe(true)
  })

  it("allows either active or frozen to move to cancelled", () => {
    expect(canTransition("active", "cancelled")).toBe(true)
    expect(canTransition("frozen", "cancelled")).toBe(true)
  })

  it("treats cancelled as terminal", () => {
    expect(canTransition("cancelled", "active")).toBe(false)
    expect(canTransition("cancelled", "frozen")).toBe(false)
    expect(canTransition("cancelled", "cancelled")).toBe(false)
  })

  it("rejects a status transitioning to itself outside the explicit cycle", () => {
    expect(canTransition("active", "active")).toBe(false)
    expect(canTransition("frozen", "frozen")).toBe(false)
  })
})
