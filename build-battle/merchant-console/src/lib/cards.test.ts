import { describe, expect, it } from "vitest"
import {
  CARD_BIN,
  canTransition,
  generateCardNumber,
  isCardCategory,
  isLuhnValid,
  isSpendHigh,
  luhnCheckDigit,
  maskCard,
  spendPercent,
} from "./cards"
import { CardStatus } from "@/data/types"

describe("luhn", () => {
  it("accepts the canonical 4242 test PAN", () => {
    expect(isLuhnValid("4242424242424242")).toBe(true)
  })

  it("rejects a number with a wrong check digit", () => {
    expect(isLuhnValid("4242424242424241")).toBe(false)
  })

  it("computes the check digit that makes a body valid", () => {
    expect(luhnCheckDigit("424242424242424")).toBe(2)
    expect(isLuhnValid("424242424242424" + luhnCheckDigit("424242424242424"))).toBe(true)
  })
})

describe("generateCardNumber", () => {
  it("always produces a 16-digit number on the 4242 BIN with a valid Luhn digit", () => {
    for (let i = 0; i < 500; i++) {
      const number = generateCardNumber()
      expect(number).toHaveLength(16)
      expect(number.startsWith(CARD_BIN)).toBe(true)
      expect(/^\d{16}$/.test(number)).toBe(true)
      expect(isLuhnValid(number)).toBe(true)
    }
  })
})

describe("maskCard", () => {
  it("masks to the bullet form with the real last four", () => {
    expect(maskCard("1234")).toBe("•••• 1234")
  })
})

describe("spend progress", () => {
  it("computes percent of the limit spent", () => {
    expect(spendPercent(0, 25000)).toBe(0)
    expect(spendPercent(12500, 25000)).toBe(50)
    expect(spendPercent(20000, 25000)).toBe(80)
  })

  it("clamps over-limit spend to 100 and guards a zero limit", () => {
    expect(spendPercent(30000, 25000)).toBe(100)
    expect(spendPercent(100, 0)).toBe(0)
  })

  it("flags high spend only strictly past 80%", () => {
    expect(isSpendHigh(20000, 25000)).toBe(false) // exactly 80%
    expect(isSpendHigh(21000, 25000)).toBe(true) // 84%
    expect(isSpendHigh(0, 25000)).toBe(false)
  })
})

describe("isCardCategory (allowlist guard)", () => {
  it("accepts a known category and rejects anything else", () => {
    expect(isCardCategory("advertising")).toBe(true)
    expect(isCardCategory("software")).toBe(true)
    expect(isCardCategory("gambling")).toBe(false)
    expect(isCardCategory("")).toBe(false)
    expect(isCardCategory(undefined)).toBe(false)
    expect(isCardCategory(42)).toBe(false)
  })
})

describe("canTransition (status state machine)", () => {
  it("allows active ⇄ frozen and either → cancelled", () => {
    expect(canTransition("active", "frozen")).toBe(true)
    expect(canTransition("frozen", "active")).toBe(true)
    expect(canTransition("active", "cancelled")).toBe(true)
    expect(canTransition("frozen", "cancelled")).toBe(true)
  })

  it("treats cancelled as terminal", () => {
    expect(canTransition("cancelled", "active")).toBe(false)
    expect(canTransition("cancelled", "frozen")).toBe(false)
    expect(canTransition("cancelled", "cancelled")).toBe(false)
  })

  it("rejects no-op transitions to the same status", () => {
    const statuses: CardStatus[] = ["active", "frozen", "cancelled"]
    for (const status of statuses) {
      expect(canTransition(status, status)).toBe(false)
    }
  })
})
