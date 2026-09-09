import { describe, expect, it } from "vitest"
import {
  barWidthClass,
  canTransition,
  generateCardNumber,
  isLuhnValid,
  maskCardNumber,
  spendPercent,
  TEST_BIN,
} from "./cards"

/**
 * The card rules that cannot drift: the test BIN, the Luhn check digit, and
 * the status machine. The Luhn below is written out a second time on purpose
 * — checking the generator with the function that built it proves nothing.
 */

/** An independent Luhn, written from the definition rather than reused. */
function luhnMod10(cardNumber: string): number {
  const digits = [...cardNumber].map(Number).reverse()
  const sum = digits.reduce((total, digit, index) => {
    if (index % 2 === 0) return total + digit
    const doubled = digit * 2
    return total + (doubled > 9 ? doubled - 9 : doubled)
  }, 0)
  return sum % 10
}

/** Deterministic sequence, so a failure reproduces. */
function seeded(seed: number) {
  let state = seed
  return () => {
    state = (state * 1664525 + 1013904223) % 4294967296
    return state / 4294967296
  }
}

describe("generateCardNumber", () => {
  it("produces sixteen digits on the test BIN with a valid check digit", () => {
    const random = seeded(20260813)
    for (let i = 0; i < 500; i++) {
      const number = generateCardNumber(random)
      expect(number).toHaveLength(16)
      expect(number.startsWith(TEST_BIN)).toBe(true)
      expect(luhnMod10(number)).toBe(0)
    }
  })

  it("is generated, not a constant", () => {
    // A hardcoded number would pass every check above and fail this one.
    const numbers = new Set(
      Array.from({ length: 50 }, () => generateCardNumber()),
    )
    expect(numbers.size).toBeGreaterThan(1)
  })
})

describe("isLuhnValid", () => {
  it("accepts a valid number and rejects one flipped digit", () => {
    const number = generateCardNumber(seeded(7))
    expect(isLuhnValid(number)).toBe(true)

    const digit = Number(number[8])
    const flipped = number.slice(0, 8) + ((digit + 1) % 10) + number.slice(9)
    expect(isLuhnValid(flipped)).toBe(false)
  })

  it("rejects anything that is not a run of digits", () => {
    expect(isLuhnValid("4242-4242-4242-4242")).toBe(false)
    expect(isLuhnValid("")).toBe(false)
  })
})

describe("maskCardNumber", () => {
  it("is the last four and nothing else", () => {
    expect(maskCardNumber("4242")).toBe("•••• 4242")
  })
})

describe("canTransition", () => {
  it("allows active and frozen to swap, and either to cancel", () => {
    expect(canTransition("active", "frozen")).toBe(true)
    expect(canTransition("frozen", "active")).toBe(true)
    expect(canTransition("active", "cancelled")).toBe(true)
    expect(canTransition("frozen", "cancelled")).toBe(true)
  })

  it("treats cancelled as terminal and refuses a no-op", () => {
    expect(canTransition("cancelled", "active")).toBe(false)
    expect(canTransition("cancelled", "frozen")).toBe(false)
    expect(canTransition("cancelled", "cancelled")).toBe(false)
    expect(canTransition("active", "active")).toBe(false)
    expect(canTransition("frozen", "frozen")).toBe(false)
  })
})

describe("spendPercent", () => {
  it("is whole percent from integer minor units, and never over 100", () => {
    expect(spendPercent(0, 25000)).toBe(0)
    expect(spendPercent(20000, 25000)).toBe(80)
    expect(spendPercent(20250, 25000)).toBe(81)
    expect(spendPercent(30000, 25000)).toBe(100)
    expect(spendPercent(100, 0)).toBe(0)
  })
})

describe("barWidthClass", () => {
  it("snaps to a literal class Tailwind can compile", () => {
    expect(barWidthClass(0)).toBe("w-[0%]")
    expect(barWidthClass(81)).toBe("w-[80%]")
    expect(barWidthClass(100)).toBe("w-[100%]")
  })
})
