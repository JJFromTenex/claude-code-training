import { describe, expect, it } from "vitest"
import {
  CARD_TRANSITIONS,
  TEST_BIN,
  canTransition,
  formatCardNumber,
  generateCardNumber,
  isValidLuhn,
  luhnCheckDigit,
  maskCardNumber,
} from "./cards"
import { CardStatus } from "@/data/types"

/**
 * Every number in this file is generated on the 4242 test BIN. Nothing here,
 * fixtures included, may resemble a real PAN.
 */

/** Deterministic digits, so a failure reproduces on every machine. */
function sequence(values: number[]): () => number {
  let i = 0
  return () => values[i++ % values.length]
}

describe("luhnCheckDigit", () => {
  it("produces the digit that makes the number validate", () => {
    // 4242424242424242 is the canonical test card; its body is the first 15.
    expect(luhnCheckDigit("424242424242424")).toBe(2)
  })

  it("produces a zero when the doubled sum is already a multiple of ten", () => {
    expect(luhnCheckDigit("424242424242420")).toBe(0)
    expect(isValidLuhn("4242424242424200")).toBe(true)
  })
})

describe("isValidLuhn", () => {
  it("accepts a number carrying the right check digit", () => {
    expect(isValidLuhn("4242424242424242")).toBe(true)
  })

  it("rejects a number whose check digit is wrong", () => {
    expect(isValidLuhn("4242424242424243")).toBe(false)
  })

  it("rejects anything that is not all digits", () => {
    expect(isValidLuhn("4242 4242 4242 4242")).toBe(false)
    expect(isValidLuhn("")).toBe(false)
  })
})

describe("generateCardNumber", () => {
  it("returns sixteen digits on the test BIN with a valid check digit", () => {
    const number = generateCardNumber(sequence([0.1, 0.7, 0.3, 0.9, 0.5]))
    expect(number).toHaveLength(16)
    expect(number.startsWith(TEST_BIN)).toBe(true)
    expect(isValidLuhn(number)).toBe(true)
  })

  it("holds for every digit the generator can draw", () => {
    // One number per possible leading random digit, so no draw slips through
    // producing a bad check digit or leaving the BIN.
    for (let digit = 0; digit <= 9; digit++) {
      const number = generateCardNumber(sequence([digit / 10]))
      expect(number.startsWith(TEST_BIN)).toBe(true)
      expect(number).toHaveLength(16)
      expect(isValidLuhn(number)).toBe(true)
    }
  })

  it("never produces a number outside the test BIN", () => {
    for (let i = 0; i < 200; i++) {
      expect(generateCardNumber().slice(0, 4)).toBe("4242")
    }
  })
})

describe("maskCardNumber", () => {
  it("is the only shape a stored number is ever shown in", () => {
    expect(maskCardNumber("4242")).toBe("•••• 4242")
  })
})

describe("formatCardNumber", () => {
  it("groups a full number into fours for the reveal screen", () => {
    expect(formatCardNumber("4242424242424242")).toBe("4242 4242 4242 4242")
  })
})

describe("canTransition", () => {
  it("moves a card between active and frozen in both directions", () => {
    expect(canTransition("active", "frozen")).toBe(true)
    expect(canTransition("frozen", "active")).toBe(true)
  })

  it("cancels from either live state", () => {
    expect(canTransition("active", "cancelled")).toBe(true)
    expect(canTransition("frozen", "cancelled")).toBe(true)
  })

  it("treats cancelled as terminal", () => {
    expect(canTransition("cancelled", "active")).toBe(false)
    expect(canTransition("cancelled", "frozen")).toBe(false)
    expect(canTransition("cancelled", "cancelled")).toBe(false)
  })

  it("refuses a transition to the status the card already has", () => {
    expect(canTransition("active", "active")).toBe(false)
    expect(canTransition("frozen", "frozen")).toBe(false)
  })

  it("covers every pair in the machine, so nothing is left undecided", () => {
    const statuses: CardStatus[] = ["active", "frozen", "cancelled"]
    const allowed = statuses.flatMap((from) =>
      statuses.filter((to) => canTransition(from, to)).map((to) => `${from}>${to}`),
    )
    expect(allowed.sort()).toEqual([
      "active>cancelled",
      "active>frozen",
      "frozen>active",
      "frozen>cancelled",
    ])
    expect(CARD_TRANSITIONS.cancelled).toHaveLength(0)
  })
})
