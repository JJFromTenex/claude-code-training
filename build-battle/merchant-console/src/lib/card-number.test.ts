import { describe, expect, it } from "vitest"
import { TEST_BIN, generateCardNumber, isLuhnValid, maskedNumber } from "./card-number"

/**
 * A check digit cannot be verified by looking at it, so the generator gets a
 * test before anything consumes it. The BIN matters just as much: a generated
 * number that drifts off 4242 is a number that could resemble a real PAN.
 */

describe("generateCardNumber", () => {
  it("puts every number on the 4242 test BIN", () => {
    for (let i = 0; i < 200; i++) {
      expect(generateCardNumber().startsWith(TEST_BIN)).toBe(true)
    }
  })

  it("generates sixteen digits that satisfy Luhn", () => {
    for (let i = 0; i < 200; i++) {
      const number = generateCardNumber()
      expect(number).toMatch(/^\d{16}$/)
      expect(isLuhnValid(number)).toBe(true)
    }
  })

  it("is deterministic when handed a deterministic source", () => {
    const fixed = () => 0.5
    expect(generateCardNumber(fixed)).toBe(generateCardNumber(fixed))
  })
})

describe("isLuhnValid", () => {
  it("rejects a number one digit off", () => {
    const number = generateCardNumber()
    const lastDigit = Number(number[15])
    const wrong = number.slice(0, 15) + ((lastDigit + 1) % 10)
    expect(isLuhnValid(wrong)).toBe(false)
  })

  it("rejects anything that is not all digits", () => {
    expect(isLuhnValid("4242 4242 4242 4242")).toBe(false)
    expect(isLuhnValid("")).toBe(false)
  })
})

describe("maskedNumber", () => {
  it("shows the last four and nothing else", () => {
    expect(maskedNumber("4242")).toBe("•••• 4242")
  })
})
