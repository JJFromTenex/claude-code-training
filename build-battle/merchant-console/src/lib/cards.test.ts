import { describe, expect, it } from "vitest"

import { CardStatus } from "@/data/types"
import {
  canTransition,
  generateCardNumber,
  luhnCheckDigit,
  maskedNumber,
} from "./cards"

/**
 * An independent Luhn validator, written from the algorithm rather than from
 * `luhnCheckDigit`. A generator checked by its own check-digit function proves
 * only that it is self-consistent.
 */
function luhnIsValid(number: string): boolean {
  let sum = 0
  for (let i = 0; i < number.length; i++) {
    const digit = Number(number[number.length - 1 - i])
    if (i % 2 === 1) {
      const doubled = digit * 2
      sum += doubled > 9 ? doubled - 9 : doubled
    } else {
      sum += digit
    }
  }
  return sum % 10 === 0
}

describe("luhnIsValid", () => {
  it("accepts known-good test numbers", () => {
    expect(luhnIsValid("4242424242424242")).toBe(true)
  })

  it("rejects the same number with one digit changed", () => {
    expect(luhnIsValid("4242424242424243")).toBe(false)
  })
})

describe("generateCardNumber", () => {
  const numbers = Array.from({ length: 200 }, generateCardNumber)

  it("is 16 digits", () => {
    for (const number of numbers) {
      expect(number).toMatch(/^\d{16}$/)
    }
  })

  it("starts with the 4242 test BIN", () => {
    for (const number of numbers) {
      expect(number.startsWith("4242")).toBe(true)
    }
  })

  it("carries a valid Luhn check digit", () => {
    for (const number of numbers) {
      expect(luhnIsValid(number)).toBe(true)
    }
  })

  it("fails validation if any single digit is altered", () => {
    const number = generateCardNumber()
    for (let i = 0; i < number.length; i++) {
      const altered =
        number.slice(0, i) +
        ((Number(number[i]) + 1) % 10) +
        number.slice(i + 1)
      expect(luhnIsValid(altered)).toBe(false)
    }
  })

  it("does not return the same number twice", () => {
    expect(new Set(numbers).size).toBe(numbers.length)
  })
})

describe("luhnCheckDigit", () => {
  it("completes a partial number so the whole validates", () => {
    const partial = "424242424242424"
    expect(luhnCheckDigit(partial)).toBe(2)
    expect(luhnIsValid(partial + luhnCheckDigit(partial))).toBe(true)
  })

  it("returns a single digit", () => {
    for (const partial of ["424200000000000", "424299999999999"]) {
      const digit = luhnCheckDigit(partial)
      expect(digit).toBeGreaterThanOrEqual(0)
      expect(digit).toBeLessThanOrEqual(9)
    }
  })
})

describe("maskedNumber", () => {
  it("shows the last four and nothing else", () => {
    expect(maskedNumber("8291")).toBe("•••• 8291")
  })

  it("masks the BIN, not the last four", () => {
    const number = generateCardNumber()
    const masked = maskedNumber(number.slice(-4))
    expect(masked).not.toContain(number)
    expect(masked.startsWith("4242")).toBe(false)
  })
})

describe("canTransition", () => {
  it("allows active and frozen in both directions", () => {
    expect(canTransition("active", "frozen")).toBe(true)
    expect(canTransition("frozen", "active")).toBe(true)
  })

  it("allows either to cancelled", () => {
    expect(canTransition("active", "cancelled")).toBe(true)
    expect(canTransition("frozen", "cancelled")).toBe(true)
  })

  it("treats cancelled as terminal", () => {
    const all: CardStatus[] = ["active", "frozen", "cancelled"]
    for (const to of all) {
      expect(canTransition("cancelled", to)).toBe(false)
    }
  })

  it("rejects a transition to the same status", () => {
    const all: CardStatus[] = ["active", "frozen", "cancelled"]
    for (const status of all) {
      expect(canTransition(status, status)).toBe(false)
    }
  })
})
