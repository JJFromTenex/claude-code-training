import { describe, expect, it } from "vitest"
import {
  CARD_CATEGORY_LABELS,
  CARD_NUMBER_LENGTH,
  CARD_TRANSITIONS,
  SPEND_WARNING_THRESHOLD,
  TEST_BIN,
  canTransition,
  generateCardNumber,
  generateNumberReference,
  isSpendWarning,
  isValidLuhn,
  luhnCheckDigit,
  maskCardNumber,
  spendRatio,
} from "./cards"

describe("luhnCheckDigit", () => {
  it("matches the textbook example", () => {
    expect(luhnCheckDigit("7992739871")).toBe("3")
  })

  it("completes a test-BIN number that validates", () => {
    const body = "424242424242424"
    expect(luhnCheckDigit(body)).toBe("2")
    expect(isValidLuhn(body + luhnCheckDigit(body))).toBe(true)
  })
})

describe("isValidLuhn", () => {
  it("accepts a known-good number", () => {
    expect(isValidLuhn("4242424242424242")).toBe(true)
    expect(isValidLuhn("79927398713")).toBe(true)
  })

  it("rejects a number with a single digit changed", () => {
    expect(isValidLuhn("4242424242424243")).toBe(false)
    expect(isValidLuhn("4242424252424242")).toBe(false)
  })

  it("rejects non-digits and empty input", () => {
    expect(isValidLuhn("4242 4242 4242 4242")).toBe(false)
    expect(isValidLuhn("4242-4242-4242-4242")).toBe(false)
    expect(isValidLuhn("424242424242424x")).toBe(false)
    expect(isValidLuhn("")).toBe(false)
  })
})

describe("generateCardNumber", () => {
  it("only ever mints valid test-BIN numbers", () => {
    const seen = new Set<string>()
    for (let i = 0; i < 500; i++) {
      const number = generateCardNumber()
      expect(number).toHaveLength(CARD_NUMBER_LENGTH)
      expect(number).toMatch(/^\d{16}$/)
      expect(number.startsWith(TEST_BIN)).toBe(true)
      expect(isValidLuhn(number)).toBe(true)
      seen.add(number)
    }
    expect(seen.size).toBeGreaterThan(1)
  })
})

describe("generateNumberReference", () => {
  it("is an opaque prefixed hex handle", () => {
    expect(generateNumberReference()).toMatch(/^pan_[0-9a-f]{24}$/)
  })

  it("differs between calls", () => {
    expect(generateNumberReference()).not.toBe(generateNumberReference())
  })
})

describe("maskCardNumber", () => {
  it("renders the bullets the payments table already uses", () => {
    expect(maskCardNumber("4242")).toBe("•••• 4242")
  })
})

describe("canTransition", () => {
  it("allows freeze, unfreeze, and cancel from either live state", () => {
    expect(canTransition("active", "frozen")).toBe(true)
    expect(canTransition("frozen", "active")).toBe(true)
    expect(canTransition("active", "cancelled")).toBe(true)
    expect(canTransition("frozen", "cancelled")).toBe(true)
  })

  it("treats cancelled as terminal", () => {
    expect(canTransition("cancelled", "active")).toBe(false)
    expect(canTransition("cancelled", "frozen")).toBe(false)
    expect(CARD_TRANSITIONS.cancelled).toHaveLength(0)
  })

  it("rejects a move to the status the card is already in", () => {
    expect(canTransition("active", "active")).toBe(false)
    expect(canTransition("frozen", "frozen")).toBe(false)
    expect(canTransition("cancelled", "cancelled")).toBe(false)
  })
})

describe("spendRatio", () => {
  it("is zero on a card that has not been used", () => {
    expect(spendRatio(0, 25000)).toBe(0)
  })

  it("reports the fraction of the limit spent", () => {
    expect(spendRatio(20000, 25000)).toBe(0.8)
    expect(spendRatio(12500, 25000)).toBe(0.5)
  })

  it("clamps once spend passes the limit", () => {
    expect(spendRatio(30000, 25000)).toBe(1)
  })

  it("returns zero rather than dividing by a limit that is not there", () => {
    expect(spendRatio(20000, 0)).toBe(0)
    expect(spendRatio(20000, -1)).toBe(0)
  })
})

describe("isSpendWarning", () => {
  it("stays quiet below the threshold", () => {
    expect(isSpendWarning(0, 25000)).toBe(false)
    expect(isSpendWarning(19999, 25000)).toBe(false)
  })

  it("warns at and past the threshold", () => {
    expect(SPEND_WARNING_THRESHOLD).toBe(0.8)
    expect(isSpendWarning(20000, 25000)).toBe(true)
    expect(isSpendWarning(30000, 25000)).toBe(true)
  })

  it("never warns on a card with no limit to exceed", () => {
    expect(isSpendWarning(20000, 0)).toBe(false)
  })
})

describe("CARD_CATEGORY_LABELS", () => {
  it("labels every category the store can hold", () => {
    expect(CARD_CATEGORY_LABELS.subscriptions).toBe("Vendor subscriptions")
    expect(CARD_CATEGORY_LABELS.advertising).toBe("Advertising")
    expect(CARD_CATEGORY_LABELS.contractor_tools).toBe("Contractor tools")
  })
})
