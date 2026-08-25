import { describe, expect, it } from "vitest"
import {
  canTransition,
  generateCardNumber,
  isValidLuhn,
  last4FromNumber,
  maskedNumber,
} from "./cards"

/** Deterministic PRNG so a failing case reproduces the same way every run. */
function mulberry32(seed: number) {
  let a = seed
  return function () {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

describe("generateCardNumber", () => {
  it("starts with the 4242 test BIN", () => {
    const random = mulberry32(1)
    for (let i = 0; i < 20; i++) {
      expect(generateCardNumber(random).startsWith("4242")).toBe(true)
    }
  })

  it("is 16 digits", () => {
    expect(generateCardNumber(mulberry32(2))).toHaveLength(16)
  })

  it("carries a valid Luhn check digit across many draws, not just by luck once", () => {
    const random = mulberry32(3)
    for (let i = 0; i < 50; i++) {
      const number = generateCardNumber(random)
      expect(isValidLuhn(number)).toBe(true)
    }
  })

  it("does not repeat the same number on consecutive calls", () => {
    const random = mulberry32(4)
    const first = generateCardNumber(random)
    const second = generateCardNumber(random)
    expect(first).not.toBe(second)
  })
})

describe("isValidLuhn", () => {
  it("accepts a known-valid test number", () => {
    // Stripe's published 4242 test card — a fixed, well-known Luhn-valid number.
    expect(isValidLuhn("4242424242424242")).toBe(true)
  })

  it("rejects a number with a corrupted check digit", () => {
    expect(isValidLuhn("4242424242424241")).toBe(false)
  })

  it("rejects a non-numeric string rather than throwing", () => {
    expect(isValidLuhn("4242-4242-4242")).toBe(false)
  })
})

describe("last4FromNumber / maskedNumber", () => {
  it("takes the last four digits of the full number", () => {
    expect(last4FromNumber("4242424242421337")).toBe("1337")
  })

  it("masks with dots ahead of the last four", () => {
    expect(maskedNumber("1337")).toBe("•••• 1337")
  })
})

describe("canTransition", () => {
  it("allows active to frozen and back", () => {
    expect(canTransition("active", "frozen")).toBe(true)
    expect(canTransition("frozen", "active")).toBe(true)
  })

  it("allows active or frozen to cancelled", () => {
    expect(canTransition("active", "cancelled")).toBe(true)
    expect(canTransition("frozen", "cancelled")).toBe(true)
  })

  it("treats cancelled as terminal", () => {
    expect(canTransition("cancelled", "active")).toBe(false)
    expect(canTransition("cancelled", "frozen")).toBe(false)
  })

  it("rejects a no-op transition to the same status", () => {
    expect(canTransition("active", "active")).toBe(false)
    expect(canTransition("frozen", "frozen")).toBe(false)
  })
})
