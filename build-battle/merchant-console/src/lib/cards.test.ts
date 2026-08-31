import { describe, expect, it } from "vitest"
import { CardStatus } from "@/data/types"
import {
  CARD_BIN,
  allowedTransitions,
  generateCardNumber,
  isValidCardTransition,
  isValidLuhn,
  last4Of,
  luhnCheckDigit,
  maskCardNumber,
} from "./cards"

/**
 * A card number that fails Luhn is rejected by everything downstream, and a
 * number that is not on the test BIN is a compliance problem rather than a
 * bug. Both are cheap to pin here and expensive to find in review.
 */

describe("luhnCheckDigit", () => {
  it("produces the digit that completes a known-valid number", () => {
    // 424242424242424 + 2 is the canonical test PAN.
    expect(luhnCheckDigit("424242424242424")).toBe("2")
  })

  it("produces check digits computed by hand, not by the same code path", () => {
    // Worked out independently: doubling runs right-to-left from the digit
    // left of the check position. If the doubling parity or the -9 wrap breaks,
    // these fail — which asserting against isValidLuhn would not, since both
    // read the same implementation.
    expect(luhnCheckDigit("4242")).toBe("4")
    expect(luhnCheckDigit("42424242")).toBe("8")
    expect(luhnCheckDigit("4000056655665")).toBe("2")
    // 79927398713 is the textbook Luhn example; its check digit is 3.
    expect(luhnCheckDigit("7992739871")).toBe("3")
  })
})

describe("isValidLuhn", () => {
  it("accepts the canonical test PAN", () => {
    expect(isValidLuhn("4242424242424242")).toBe(true)
  })

  it("rejects a number one digit off", () => {
    expect(isValidLuhn("4242424242424243")).toBe(false)
  })

  it("rejects anything that is not all digits", () => {
    expect(isValidLuhn("4242-4242-4242-4242")).toBe(false)
    expect(isValidLuhn("")).toBe(false)
  })
})

describe("generateCardNumber", () => {
  it("always starts with the 4242 test BIN, so nothing here resembles a real PAN", () => {
    for (let i = 0; i < 200; i++) {
      expect(generateCardNumber().startsWith(CARD_BIN)).toBe(true)
    }
  })

  it("always carries a valid Luhn check digit", () => {
    for (let i = 0; i < 200; i++) {
      expect(isValidLuhn(generateCardNumber())).toBe(true)
    }
  })

  it("is 16 digits", () => {
    expect(generateCardNumber()).toMatch(/^\d{16}$/)
  })
})

describe("maskCardNumber", () => {
  it("shows the last four behind dots, the only form allowed after creation", () => {
    const number = generateCardNumber()
    expect(maskCardNumber(last4Of(number))).toBe(`•••• ${number.slice(-4)}`)
  })

  it("never contains the full number", () => {
    const number = generateCardNumber()
    expect(maskCardNumber(last4Of(number))).not.toContain(number)
  })
})

describe("isValidCardTransition", () => {
  it("allows a card to be frozen and thawed", () => {
    expect(isValidCardTransition("active", "frozen")).toBe(true)
    expect(isValidCardTransition("frozen", "active")).toBe(true)
  })

  it("allows either live state to be cancelled", () => {
    expect(isValidCardTransition("active", "cancelled")).toBe(true)
    expect(isValidCardTransition("frozen", "cancelled")).toBe(true)
  })

  it("lets nothing back out of cancelled — it is terminal", () => {
    const statuses: CardStatus[] = ["active", "frozen", "cancelled"]
    for (const to of statuses) {
      expect(isValidCardTransition("cancelled", to)).toBe(false)
    }
  })

  it("rejects a transition to the state the card is already in", () => {
    expect(isValidCardTransition("active", "active")).toBe(false)
    expect(isValidCardTransition("frozen", "frozen")).toBe(false)
  })
})

describe("allowedTransitions", () => {
  it("offers nothing on a cancelled card", () => {
    expect(allowedTransitions("cancelled")).toEqual([])
  })

  it("offers exactly the moves the state machine allows, spelled out", () => {
    // Written out rather than compared against isValidCardTransition: both
    // read the same table, so that comparison passes even with the table wrong.
    expect(allowedTransitions("active")).toEqual(["frozen", "cancelled"])
    expect(allowedTransitions("frozen")).toEqual(["active", "cancelled"])
  })
})
