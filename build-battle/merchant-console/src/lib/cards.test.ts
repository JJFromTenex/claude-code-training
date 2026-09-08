import { describe, expect, it } from "vitest"
import { canTransition, generateCardNumber, isLuhnValid, maskCard } from "./cards"

/**
 * Two rules earn most of these tests: nothing generated here may resemble a real
 * PAN, and a cancelled card never comes back. Both are the kind of thing that
 * looks right in the UI long after it has stopped being true.
 */

/** An independent Luhn, written the other way round from the one under test. If the two disagree, one of them is wrong. */
function luhnByHand(cardNumber: string): boolean {
  const total = cardNumber.split("").reverse().map(Number).reduce((sum, digit, index) => {
    if (index % 2 === 0) return sum + digit
    const doubled = digit * 2
    return sum + (doubled > 9 ? doubled - 9 : doubled)
  }, 0)
  return total % 10 === 0
}

describe("generateCardNumber", () => {
  it("gives sixteen digits on the test BIN, Luhn-valid and unique across a batch", () => {
    const numbers = Array.from({ length: 200 }, () => generateCardNumber())

    for (const number of numbers) {
      expect(number).toHaveLength(16)
      expect(number.startsWith("4242")).toBe(true)
      expect(/^\d{16}$/.test(number)).toBe(true)
      expect(isLuhnValid(number)).toBe(true)
      expect(luhnByHand(number)).toBe(true)
    }

    expect(new Set(numbers).size).toBe(numbers.length)
  })
})

describe("isLuhnValid", () => {
  it("accepts a known-good number and rejects the same number with one digit flipped", () => {
    expect(isLuhnValid("4242424242424242")).toBe(true)
    expect(isLuhnValid("4242424242424243")).toBe(false)
    expect(isLuhnValid("4242424242424142")).toBe(false)
  })
})

describe("maskCard", () => {
  it("is how a card reads everywhere except the creation response", () => {
    expect(maskCard("4242")).toBe("•••• 4242")
  })
})

describe("canTransition", () => {
  // The full matrix: active and frozen swap, either can be cancelled, cancelled
  // is terminal, and nothing transitions to itself.
  it.each([
    ["active", "active", false],
    ["active", "frozen", true],
    ["active", "cancelled", true],
    ["frozen", "active", true],
    ["frozen", "frozen", false],
    ["frozen", "cancelled", true],
    ["cancelled", "active", false],
    ["cancelled", "frozen", false],
    ["cancelled", "cancelled", false],
  ] as const)("%s to %s is %s", (from, to, allowed) => {
    expect(canTransition(from, to)).toBe(allowed)
  })
})
