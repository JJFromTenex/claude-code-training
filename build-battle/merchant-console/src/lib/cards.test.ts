import { describe, expect, it } from "vitest"
import {
  CARD_BIN,
  CARD_NUMBER_LENGTH,
  canTransition,
  generateCardNumber,
  isLuhnValid,
  isNearLimit,
  spendPercentage,
} from "./cards"

/**
 * Card numbers are randomized test data, so generation is checked across
 * many samples rather than a single fixed value.
 */

describe("generateCardNumber", () => {
  it("always starts with the 4242 test BIN, is 16 digits, and passes Luhn", () => {
    for (let i = 0; i < 100; i++) {
      const number = generateCardNumber()
      expect(number.startsWith(CARD_BIN)).toBe(true)
      expect(number).toHaveLength(CARD_NUMBER_LENGTH)
      expect(/^\d+$/.test(number)).toBe(true)
      expect(isLuhnValid(number)).toBe(true)
    }
  })
})

describe("isLuhnValid", () => {
  it("rejects a number with a corrupted last digit", () => {
    const valid = generateCardNumber()
    const lastDigit = Number(valid.slice(-1))
    const corruptedDigit = (lastDigit + 1) % 10
    const corrupted = valid.slice(0, -1) + String(corruptedDigit)
    expect(isLuhnValid(corrupted)).toBe(false)
  })

  it("agrees with known real Luhn vectors, not just its own generator", () => {
    // Self-consistency (generate then validate with the same function) can't
    // catch an algorithm that is wrong in the same way both times. These are
    // independently-known-valid/invalid numbers per the standard Luhn check.
    expect(isLuhnValid("4242424242424242")).toBe(true)
    expect(isLuhnValid("4111111111111111")).toBe(true)
    expect(isLuhnValid("4242424242424241")).toBe(false)
  })
})

describe("canTransition", () => {
  it("allows active to frozen", () => {
    expect(canTransition("active", "frozen")).toBe(true)
  })

  it("allows frozen to active", () => {
    expect(canTransition("frozen", "active")).toBe(true)
  })

  it("allows active to cancelled", () => {
    expect(canTransition("active", "cancelled")).toBe(true)
  })

  it("allows frozen to cancelled", () => {
    expect(canTransition("frozen", "cancelled")).toBe(true)
  })

  it("does not allow cancelled to active", () => {
    expect(canTransition("cancelled", "active")).toBe(false)
  })

  it("does not allow cancelled to frozen", () => {
    expect(canTransition("cancelled", "frozen")).toBe(false)
  })

  it("does not allow a status to transition to itself", () => {
    expect(canTransition("active", "active")).toBe(false)
  })
})

describe("spendPercentage / isNearLimit", () => {
  it("is 0% at 0 spent", () => {
    expect(spendPercentage(0, 10000)).toBe(0)
    expect(isNearLimit(0, 10000)).toBe(false)
  })

  it("treats exactly 80% as near-limit", () => {
    expect(spendPercentage(8000, 10000)).toBe(80)
    expect(isNearLimit(8000, 10000)).toBe(true)
  })

  it("does not treat 79% as near-limit", () => {
    expect(spendPercentage(7900, 10000)).toBe(79)
    expect(isNearLimit(7900, 10000)).toBe(false)
  })

  it("clamps over-limit spend to 100", () => {
    expect(spendPercentage(15000, 10000)).toBe(100)
    expect(isNearLimit(15000, 10000)).toBe(true)
  })

  it("returns 0 for a non-positive limit without dividing by zero", () => {
    expect(spendPercentage(500, 0)).toBe(0)
    expect(spendPercentage(500, -100)).toBe(0)
    expect(isNearLimit(500, 0)).toBe(false)
  })
})
