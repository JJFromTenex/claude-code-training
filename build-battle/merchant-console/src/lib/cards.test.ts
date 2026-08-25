import { CardStatus } from "@/data/types"
import { describe, expect, it } from "vitest"
import {
  CARD_BIN,
  canTransition,
  formatCardNumber,
  generateCardNumber,
  isLuhnValid,
  luhnCheckDigit,
  maskCard,
} from "./cards"

describe("luhnCheckDigit", () => {
  it("completes the classic test prefix", () => {
    // 4242 4242 4242 4242 is the canonical test number; its check digit is 2.
    expect(luhnCheckDigit("424242424242424")).toBe("2")
  })

})

describe("isLuhnValid", () => {
  it("rejects a flipped check digit and non-digits", () => {
    expect(isLuhnValid("4242424242424242")).toBe(true)
    expect(isLuhnValid("4242424242424243")).toBe(false)
    expect(isLuhnValid("4242 4242 4242 4242")).toBe(false)
  })
})

describe("generateCardNumber", () => {
  it("is sixteen digits on the 4242 BIN with a valid check digit, every time", () => {
    for (let i = 0; i < 500; i++) {
      const number = generateCardNumber()
      expect(number).toMatch(/^\d{16}$/)
      expect(number.startsWith(CARD_BIN)).toBe(true)
      expect(isLuhnValid(number)).toBe(true)
    }
  })

  it("is deterministic for a pinned random source", () => {
    expect(generateCardNumber(() => 0)).toBe("4242000000000000")
    const nines = generateCardNumber(() => 0.99)
    expect(nines).toMatch(/^424299999999999\d$/)
    expect(isLuhnValid(nines)).toBe(true)
  })

})

describe("masking", () => {
  it("shows only the last four", () => {
    expect(maskCard("4242")).toBe("•••• 4242")
    expect(formatCardNumber("4242424242424242")).toBe("4242 4242 4242 4242")
  })
})

describe("canTransition", () => {
  const STATUSES: CardStatus[] = ["active", "frozen", "cancelled"]
  const LEGAL = new Set([
    "active→frozen",
    "active→cancelled",
    "frozen→active",
    "frozen→cancelled",
  ])

  it("covers every pair, so a new status cannot slip in unnoticed", () => {
    for (const from of STATUSES) {
      for (const to of STATUSES) {
        expect(canTransition(from, to), `${from}→${to}`).toBe(
          LEGAL.has(`${from}→${to}`),
        )
      }
    }
  })

  it("keeps cancelled terminal", () => {
    for (const to of STATUSES) expect(canTransition("cancelled", to)).toBe(false)
  })
})
