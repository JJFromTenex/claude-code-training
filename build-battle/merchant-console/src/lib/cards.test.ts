import { describe, expect, it } from "vitest"
import {
  CARD_NUMBER_LENGTH,
  MAX_SPEND_LIMIT,
  TEST_BIN,
  canTransition,
  formatCardNumber,
  generateCardNumber,
  isLuhnValid,
  luhnCheckDigit,
  maskCardNumber,
  parseCardStatus,
  validateIssueCard,
} from "./cards"

/**
 * The card number rules are the ones that make this repository safe to keep
 * on a laptop: the 4242 test BIN, a valid check digit, and a number that is
 * never readable after the issue response. The state machine is what stops a
 * cancelled card coming back. Both are pinned here.
 */

/** A counter dressed as an RNG, so a generated number is reproducible. */
function sequenceRand(digits: number[]): () => number {
  let i = 0
  return () => digits[i++ % digits.length] / 10
}

describe("luhnCheckDigit", () => {
  it("produces a digit that makes the whole number Luhn-valid", () => {
    const partial = "424212345678901"
    expect(isLuhnValid(partial + luhnCheckDigit(partial))).toBe(true)
  })

  it("agrees with a known-good test number", () => {
    // 4242424242424242 is the canonical test PAN and is Luhn-valid.
    expect(isLuhnValid("4242424242424242")).toBe(true)
    expect(luhnCheckDigit("424242424242424")).toBe("2")
  })
})

describe("isLuhnValid", () => {
  it("rejects a number one digit off", () => {
    expect(isLuhnValid("4242424242424243")).toBe(false)
  })

  it("rejects anything that is not all digits", () => {
    expect(isLuhnValid("4242-4242-4242-4242")).toBe(false)
    expect(isLuhnValid("")).toBe(false)
  })
})

describe("generateCardNumber", () => {
  it("starts with the test BIN and is Luhn-valid", () => {
    const number = generateCardNumber(sequenceRand([7, 1, 3, 9, 0, 5, 2, 8]))
    expect(number.startsWith(TEST_BIN)).toBe(true)
    expect(number).toHaveLength(CARD_NUMBER_LENGTH)
    expect(isLuhnValid(number)).toBe(true)
  })

  it("holds those properties across many draws from the real RNG", () => {
    for (let i = 0; i < 200; i++) {
      const number = generateCardNumber()
      expect(number.startsWith(TEST_BIN)).toBe(true)
      expect(number).toHaveLength(CARD_NUMBER_LENGTH)
      expect(isLuhnValid(number)).toBe(true)
    }
  })
})

describe("maskCardNumber", () => {
  it("shows only the last four", () => {
    expect(maskCardNumber("4242")).toBe("•••• 4242")
  })
})

describe("formatCardNumber", () => {
  it("groups the reveal-once number into fours", () => {
    expect(formatCardNumber("4242123456789012")).toBe("4242 1234 5678 9012")
  })
})

describe("canTransition", () => {
  it("allows active and frozen to swap in both directions", () => {
    expect(canTransition("active", "frozen")).toBe(true)
    expect(canTransition("frozen", "active")).toBe(true)
  })

  it("allows either live status to be cancelled", () => {
    expect(canTransition("active", "cancelled")).toBe(true)
    expect(canTransition("frozen", "cancelled")).toBe(true)
  })

  it("treats cancelled as terminal", () => {
    expect(canTransition("cancelled", "active")).toBe(false)
    expect(canTransition("cancelled", "frozen")).toBe(false)
    expect(canTransition("cancelled", "cancelled")).toBe(false)
  })
})

describe("parseCardStatus", () => {
  it("accepts the three real statuses and nothing else", () => {
    expect(parseCardStatus("active")).toBe("active")
    expect(parseCardStatus("frozen")).toBe("frozen")
    expect(parseCardStatus("cancelled")).toBe("cancelled")
    expect(parseCardStatus("deleted")).toBeNull()
    expect(parseCardStatus(undefined)).toBeNull()
  })
})

describe("validateIssueCard", () => {
  const valid = {
    nickname: "Ad spend",
    merchantId: "mch_01",
    spendLimit: "250.00",
    currency: "USD",
  }

  it("accepts a good request and returns minor units", () => {
    const result = validateIssueCard(valid)
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.value.spendLimit).toBe(25000)
      expect(result.value.nickname).toBe("Ad spend")
      expect(result.value.categoryLock).toBeNull()
    }
  })

  it("trims the nickname rather than storing the whitespace", () => {
    const result = validateIssueCard({ ...valid, nickname: "  Ad spend  " })
    expect(result.ok && result.value.nickname).toBe("Ad spend")
  })

  it("rejects a missing or unknown merchant", () => {
    expect(validateIssueCard({ ...valid, merchantId: "" }).ok).toBe(false)
    expect(validateIssueCard({ ...valid, merchantId: "mch_nope" }).ok).toBe(
      false,
    )
  })

  it("rejects an empty nickname", () => {
    expect(validateIssueCard({ ...valid, nickname: "   " }).ok).toBe(false)
  })

  it("rejects a zero or negative limit", () => {
    expect(validateIssueCard({ ...valid, spendLimit: "0" }).ok).toBe(false)
    expect(validateIssueCard({ ...valid, spendLimit: "0.00" }).ok).toBe(false)
    expect(validateIssueCard({ ...valid, spendLimit: "-10" }).ok).toBe(false)
  })

  it("rejects a limit above the cap but accepts the cap itself", () => {
    expect(validateIssueCard({ ...valid, spendLimit: "50000.01" }).ok).toBe(
      false,
    )
    const atCap = validateIssueCard({ ...valid, spendLimit: "50000" })
    expect(atCap.ok).toBe(true)
    expect(atCap.ok && atCap.value.spendLimit).toBe(MAX_SPEND_LIMIT)
  })

  it("rejects a limit that is not a plain amount", () => {
    expect(validateIssueCard({ ...valid, spendLimit: "$250" }).ok).toBe(false)
    expect(validateIssueCard({ ...valid, spendLimit: "250.005" }).ok).toBe(false)
    expect(validateIssueCard({ ...valid, spendLimit: "" }).ok).toBe(false)
  })

  it("rejects a number for the limit, because its units are ambiguous", () => {
    expect(validateIssueCard({ ...valid, spendLimit: 25000 }).ok).toBe(false)
  })

  it("rejects a currency outside the supported three", () => {
    expect(validateIssueCard({ ...valid, currency: "JPY" }).ok).toBe(false)
    expect(validateIssueCard({ ...valid, currency: "" }).ok).toBe(false)
    for (const currency of ["USD", "EUR", "GBP"]) {
      expect(validateIssueCard({ ...valid, currency }).ok).toBe(true)
    }
  })

  it("accepts a known category lock and rejects an invented one", () => {
    const locked = validateIssueCard({ ...valid, categoryLock: "software" })
    expect(locked.ok && locked.value.categoryLock).toBe("software")
    expect(validateIssueCard({ ...valid, categoryLock: "crypto" }).ok).toBe(
      false,
    )
  })

  it("treats an absent or empty category as no lock", () => {
    expect(
      validateIssueCard({ ...valid, categoryLock: "" }).ok &&
        validateIssueCard({ ...valid, categoryLock: "" }),
    ).toBeTruthy()
    const blank = validateIssueCard({ ...valid, categoryLock: null })
    expect(blank.ok && blank.value.categoryLock).toBeNull()
  })

  it("rejects a body that is not an object", () => {
    expect(validateIssueCard(null).ok).toBe(false)
    expect(validateIssueCard("nickname=x").ok).toBe(false)
  })
})
