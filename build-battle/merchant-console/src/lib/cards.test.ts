import { describe, expect, it } from "vitest"
import {
  canTransition,
  generateCardNumber,
  isLuhnValid,
  luhnCheckDigit,
  maskCard,
} from "./cards"
import { CardStatus } from "@/data/types"

/**
 * Every generated number has to land on the 4242 test BIN and carry a Luhn
 * digit that actually checks out, or a "virtual card" in this console could
 * be mistaken for something that resembles a real one. Status changes are a
 * state machine guarded on the server; a bad transition here is a card that
 * unfreezes itself or comes back from cancelled. These tests exist so both
 * stay true after a refactor, not just on the day they were written.
 */

describe("generateCardNumber", () => {
  it("always starts with the 4242 test BIN and passes the Luhn check", () => {
    for (let i = 0; i < 50; i++) {
      const number = generateCardNumber()
      expect(number).toMatch(/^\d{16}$/)
      expect(number.startsWith("4242")).toBe(true)
      expect(isLuhnValid(number)).toBe(true)
    }
  })
})

describe("isLuhnValid", () => {
  it("rejects a number with a single tampered digit", () => {
    const number = generateCardNumber()
    const digits = number.split("")
    const tamperedIndex = 5
    digits[tamperedIndex] = String((Number(digits[tamperedIndex]) + 1) % 10)
    const tampered = digits.join("")

    expect(isLuhnValid(tampered)).toBe(false)
  })

  it("rejects non-digit input", () => {
    expect(isLuhnValid("4242abcd1234567")).toBe(false)
  })
})

describe("luhnCheckDigit", () => {
  it("produces the digit that makes the full number pass isLuhnValid", () => {
    const partial = "424212345678901"
    const check = luhnCheckDigit(partial)

    expect(isLuhnValid(partial + String(check))).toBe(true)
  })
})

describe("maskCard", () => {
  it("shows only the last four digits behind bullets", () => {
    expect(maskCard("4242")).toBe("•••• 4242")
  })
})

describe("canTransition", () => {
  const table: Array<[CardStatus, CardStatus, boolean]> = [
    ["active", "frozen", true],
    ["frozen", "active", true],
    ["active", "cancelled", true],
    ["frozen", "cancelled", true],
    ["active", "active", false],
    ["frozen", "frozen", false],
    ["cancelled", "active", false],
    ["cancelled", "frozen", false],
    ["cancelled", "cancelled", false],
  ]

  it.each(table)(
    "from %s to %s is allowed: %s",
    (from, to, expected) => {
      expect(canTransition(from, to)).toBe(expected)
    },
  )
})
