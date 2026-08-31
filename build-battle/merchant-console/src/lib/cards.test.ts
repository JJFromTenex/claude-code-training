import { describe, expect, it } from "vitest"
import {
  generateCardNumber,
  isLuhnValid,
  luhnCheckDigit,
  maskCard,
  nextStatus,
} from "./cards"

/**
 * The generator is the line between "test data" and "something that looks
 * like a real card", and the state machine is what keeps a cancelled card
 * cancelled. Both are pinned here so a refactor cannot quietly loosen them.
 */

/** Deterministic stand-in for Math.random, same shape as the seed PRNG. */
function seededRand(seed: number) {
  let a = seed
  return function () {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

describe("luhnCheckDigit", () => {
  it("computes the textbook example", () => {
    // 7992739871 + check digit 3 is the classic worked Luhn example.
    expect(luhnCheckDigit("7992739871")).toBe(3)
  })

  it("completes the canonical test number", () => {
    expect(luhnCheckDigit("424242424242424")).toBe(2)
  })
})

describe("isLuhnValid", () => {
  it("accepts the canonical 4242 test number", () => {
    expect(isLuhnValid("4242424242424242")).toBe(true)
  })

  it("rejects a single-digit transcription error", () => {
    expect(isLuhnValid("4242424242424241")).toBe(false)
  })

  it("rejects non-digit input rather than coercing it", () => {
    expect(isLuhnValid("4242-4242-4242-4242")).toBe(false)
    expect(isLuhnValid("")).toBe(false)
  })
})

describe("generateCardNumber", () => {
  it("always emits 16 digits on the 4242 test BIN with a valid check digit", () => {
    const rand = seededRand(20260813)
    for (let i = 0; i < 200; i++) {
      const number = generateCardNumber(rand)
      expect(number).toMatch(/^4242\d{12}$/)
      expect(isLuhnValid(number)).toBe(true)
    }
  })

  it("is deterministic for a fixed rand, so seed data is stable", () => {
    const a = generateCardNumber(seededRand(7))
    const b = generateCardNumber(seededRand(7))
    expect(a).toBe(b)
  })
})

describe("maskCard", () => {
  it("shows only the last four", () => {
    expect(maskCard("4242")).toBe("•••• 4242")
  })
})

describe("nextStatus", () => {
  it("allows active ⇄ frozen in both directions", () => {
    expect(nextStatus("active", "freeze")).toBe("frozen")
    expect(nextStatus("frozen", "unfreeze")).toBe("active")
  })

  it("allows either live status to cancel", () => {
    expect(nextStatus("active", "cancel")).toBe("cancelled")
    expect(nextStatus("frozen", "cancel")).toBe("cancelled")
  })

  it("rejects the no-op directions", () => {
    expect(nextStatus("active", "unfreeze")).toBeNull()
    expect(nextStatus("frozen", "freeze")).toBeNull()
  })

  it("treats cancelled as terminal — nothing comes back from it", () => {
    expect(nextStatus("cancelled", "freeze")).toBeNull()
    expect(nextStatus("cancelled", "unfreeze")).toBeNull()
    expect(nextStatus("cancelled", "cancel")).toBeNull()
  })
})
