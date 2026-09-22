import { describe, expect, it } from "vitest"
import { isValidLuhn, TEST_BIN } from "./cards"
import { cardReference, generateCardNumber } from "./card-number"

/**
 * Generation is the one place a number could drift off the test BIN or land
 * without a valid check digit, and either would produce something that looks
 * like a live card while nothing in the app complained.
 */

describe("generateCardNumber", () => {
  it("returns sixteen digits on the test BIN", () => {
    const number = generateCardNumber()
    expect(number).toHaveLength(16)
    expect(number.startsWith(TEST_BIN)).toBe(true)
    expect(/^\d{16}$/.test(number)).toBe(true)
  })

  it("is Luhn-valid every time", () => {
    // A generator that is right nine times in ten still ships a bad card, so
    // this asserts across a thousand rather than one.
    for (let i = 0; i < 1000; i++) {
      expect(isValidLuhn(generateCardNumber())).toBe(true)
    }
  })

  it("does not repeat itself", () => {
    expect(generateCardNumber()).not.toBe(generateCardNumber())
  })
})

describe("cardReference", () => {
  it("is opaque and unique, carrying no part of the number", () => {
    const reference = cardReference()
    expect(reference.startsWith("cref_")).toBe(true)
    expect(/\d{16}/.test(reference)).toBe(false)
    expect(reference).not.toBe(cardReference())
  })
})
