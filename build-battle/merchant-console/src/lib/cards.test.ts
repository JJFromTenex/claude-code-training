import { describe, expect, it } from "vitest"
import {
  CARD_NUMBER_LENGTH,
  TEST_BIN,
  canTransition,
  generateCardNumber,
  isLuhnValid,
  lastFour,
  luhnCheckDigit,

} from "./cards"
import { maskCardNumber } from "./card-mask"

describe("luhnCheckDigit", () => {
  it("completes a known Luhn-valid number", () => {
    // 4242424242424242 is the canonical test PAN; dropping its check digit
    // and recomputing must give it back.
    expect(luhnCheckDigit("424242424242424")).toBe(2)
  })

  it("produces a digit that makes the number valid", () => {
    const partial = "4242111122223"
    expect(isLuhnValid(`${partial}${luhnCheckDigit(partial)}`)).toBe(true)
  })
})

describe("isLuhnValid", () => {
  it("accepts a valid number", () => {
    expect(isLuhnValid("4242424242424242")).toBe(true)
  })

  it("rejects a number with a transposed digit", () => {
    expect(isLuhnValid("4242424242424243")).toBe(false)
  })

  it("rejects non-digits", () => {
    expect(isLuhnValid("4242-4242-4242-4242")).toBe(false)
  })
})

describe("generateCardNumber", () => {
  it("always uses the test BIN, the right length, and a valid check digit", () => {
    for (let i = 0; i < 200; i++) {
      const number = generateCardNumber()
      expect(number).toHaveLength(CARD_NUMBER_LENGTH)
      expect(number.startsWith(TEST_BIN)).toBe(true)
      expect(/^\d{16}$/.test(number)).toBe(true)
      expect(isLuhnValid(number)).toBe(true)
    }
  })

  it("does not return the same number twice in a row", () => {
    expect(generateCardNumber()).not.toBe(generateCardNumber())
  })
})

describe("masking", () => {
  it("takes the last four digits", () => {
    expect(lastFour("4242111122223334")).toBe("3334")
  })

  it("renders the masked form", () => {
    expect(maskCardNumber("4242")).toBe("•••• 4242")
  })
})

describe("canTransition", () => {
  it("allows active and frozen to swap", () => {
    expect(canTransition("active", "frozen")).toBe(true)
    expect(canTransition("frozen", "active")).toBe(true)
  })

  it("allows either to be cancelled", () => {
    expect(canTransition("active", "cancelled")).toBe(true)
    expect(canTransition("frozen", "cancelled")).toBe(true)
  })

  it("treats cancelled as terminal", () => {
    expect(canTransition("cancelled", "active")).toBe(false)
    expect(canTransition("cancelled", "frozen")).toBe(false)
    expect(canTransition("cancelled", "cancelled")).toBe(false)
  })

  it("rejects a transition to the status it already has", () => {
    expect(canTransition("active", "active")).toBe(false)
    expect(canTransition("frozen", "frozen")).toBe(false)
  })
})
