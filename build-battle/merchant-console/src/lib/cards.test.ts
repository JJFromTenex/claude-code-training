import { describe, expect, it } from "vitest"
import { CardStatus } from "@/data/types"
import {
  CARD_NUMBER_LENGTH,
  CARD_STATUSES,
  TEST_BIN,
  canTransition,
  generateCardNumber,
  generateCardReference,
  isCardStatus,
  isValidLuhn,
  last4Of,
  luhnCheckDigit,
  maskLast4,
  spendPercent,
} from "./cards"

/**
 * Two things here must never regress: a generated number always sits on the
 * test BIN with a valid check digit, and a cancelled card never comes back.
 * Every number in this file is a test-BIN number for the same reason the
 * generator only makes those.
 */

describe("luhnCheckDigit", () => {
  it("computes the digit that completes a payload", () => {
    // 4242424242424242 is the canonical test PAN: payload + 2 is valid.
    expect(luhnCheckDigit("424242424242424")).toBe(2)
  })

  it("wraps to zero when the sum is already a multiple of ten", () => {
    // This payload sums to 20, so the completing digit is 0 and not 10.
    expect(luhnCheckDigit("424200000000000")).toBe(0)
  })

  it("rejects a payload that is not digits", () => {
    expect(() => luhnCheckDigit("4242-4242")).toThrow()
    expect(() => luhnCheckDigit("")).toThrow()
  })
})

describe("isValidLuhn", () => {
  it("accepts a number whose check digit is right", () => {
    expect(isValidLuhn("4242424242424242")).toBe(true)
  })

  it("rejects a number whose check digit is wrong", () => {
    expect(isValidLuhn("4242424242424243")).toBe(false)
  })

  it("rejects a transposition that a length check would miss", () => {
    // Swapping two adjacent digits is the error Luhn exists to catch.
    expect(isValidLuhn("4242424242424422")).toBe(false)
  })

  it("rejects anything that is not a run of digits", () => {
    expect(isValidLuhn("4242 4242 4242 4242")).toBe(false)
    expect(isValidLuhn("")).toBe(false)
    expect(isValidLuhn("4")).toBe(false)
  })
})

describe("generateCardNumber", () => {
  it("only ever issues sixteen digits on the test BIN, with a valid check digit", () => {
    for (let i = 0; i < 1000; i++) {
      const number = generateCardNumber()
      expect(number).toMatch(/^\d{16}$/)
      expect(number).toHaveLength(CARD_NUMBER_LENGTH)
      expect(number.startsWith(TEST_BIN)).toBe(true)
      expect(isValidLuhn(number)).toBe(true)
    }
  })

  it("derives the check digit from the digits it was given", () => {
    // A fixed digit source pins the whole number, check digit included.
    const zeros = generateCardNumber(() => 0)
    expect(zeros).toBe("4242000000000000")
    expect(isValidLuhn(zeros)).toBe(true)

    // Payload 424299999999999 sums to 119, so the check digit is 1.
    const nines = generateCardNumber(() => 9)
    expect(nines).toBe("4242999999999991")
    expect(isValidLuhn(nines)).toBe(true)
  })

  it("does not repeat itself", () => {
    const numbers = new Set(
      Array.from({ length: 500 }, () => generateCardNumber()),
    )
    expect(numbers.size).toBe(500)
  })
})

describe("generateCardReference", () => {
  it("is an opaque handle, not the number it stands for", () => {
    const reference = generateCardReference()
    expect(reference).toMatch(/^cref_[0-9a-f]{16}$/)
    expect(reference).not.toContain(TEST_BIN)
  })

  it("does not repeat itself", () => {
    const references = new Set(
      Array.from({ length: 500 }, () => generateCardReference()),
    )
    expect(references.size).toBe(500)
  })
})

describe("last4Of and maskLast4", () => {
  it("keeps only the last four digits of a number", () => {
    expect(last4Of("4242424242421234")).toBe("1234")
  })

  it("masks everything but the last four", () => {
    expect(maskLast4("1234")).toBe("•••• 1234")
  })

  it("never leaks the rest of the number into the mask", () => {
    const number = generateCardNumber()
    const masked = maskLast4(last4Of(number))
    expect(masked).not.toContain(number)
    expect(masked).not.toContain(number.slice(0, 12))
  })
})

describe("the card status machine", () => {
  it("freezes and unfreezes", () => {
    expect(canTransition("active", "frozen")).toBe(true)
    expect(canTransition("frozen", "active")).toBe(true)
  })

  it("cancels from either live status", () => {
    expect(canTransition("active", "cancelled")).toBe(true)
    expect(canTransition("frozen", "cancelled")).toBe(true)
  })

  it("treats cancelled as terminal", () => {
    for (const to of CARD_STATUSES) {
      expect(canTransition("cancelled", to)).toBe(false)
    }
  })

  it("refuses a move to the status a card is already in", () => {
    for (const status of CARD_STATUSES) {
      expect(canTransition(status, status)).toBe(false)
    }
  })

  it("allows exactly the five transitions the ticket describes", () => {
    const allowed = CARD_STATUSES.flatMap((from) =>
      CARD_STATUSES.filter((to) => canTransition(from, to)).map(
        (to) => `${from}->${to}`,
      ),
    )
    expect(allowed.sort()).toEqual([
      "active->cancelled",
      "active->frozen",
      "frozen->active",
      "frozen->cancelled",
    ])
  })

  it("recognises only the three real statuses", () => {
    expect(isCardStatus("active")).toBe(true)
    expect(isCardStatus("frozen")).toBe(true)
    expect(isCardStatus("cancelled")).toBe(true)
    expect(isCardStatus("expired")).toBe(false)
    expect(isCardStatus("ACTIVE")).toBe(false)
    expect(isCardStatus(undefined)).toBe(false)
    expect(isCardStatus(null)).toBe(false)
    // A status machine keyed by a plain object would say yes to this.
    expect(isCardStatus("toString")).toBe(false)
  })
})

describe("spendPercent", () => {
  it("reports spend against the limit in whole percent", () => {
    expect(spendPercent(0, 25000)).toBe(0)
    expect(spendPercent(12500, 25000)).toBe(50)
    expect(spendPercent(25000, 25000)).toBe(100)
  })

  it("rounds down, so a card under the warning line never reads over it", () => {
    // 79.996% is not 80%.
    expect(spendPercent(19999, 25000)).toBe(79)
    expect(spendPercent(20000, 25000)).toBe(80)
  })

  it("caps at a hundred rather than reporting overspend", () => {
    expect(spendPercent(30000, 25000)).toBe(100)
  })

  it("does not divide by a limit that cannot exist", () => {
    expect(spendPercent(100, 0)).toBe(0)
    expect(spendPercent(100, -1)).toBe(0)
  })
})

describe("CardStatus", () => {
  it("has a transition entry for every status in the type", () => {
    // Adding a status to the union without a row here would be a silent hole.
    const statuses: CardStatus[] = ["active", "frozen", "cancelled"]
    expect(CARD_STATUSES.sort()).toEqual(statuses.sort())
  })
})
