import { describe, expect, it } from "vitest"
import {
  CARD_BIN,
  CARD_NUMBER_LENGTH,
  MAX_SPEND_LIMIT,
  canTransition,
  generateCardNumber,
  isLuhnValid,
  lastFour,
  luhnCheckDigit,
  maskCardNumber,
  spendPercent,
  validateIssueInput,
} from "./cards"

const MERCHANT_IDS = ["mch_01", "mch_02"]

const validInput = {
  nickname: "Ad spend — Q3",
  merchantId: "mch_01",
  spendLimit: 25000,
  currency: "USD",
  categoryLock: "advertising",
}

describe("generateCardNumber", () => {
  it("produces 16 digits on the test BIN with a valid check digit", () => {
    // One sample proves nothing about a generator. Cover the space.
    for (let i = 0; i < 1000; i++) {
      const number = generateCardNumber()
      expect(number).toHaveLength(CARD_NUMBER_LENGTH)
      expect(number.startsWith(CARD_BIN)).toBe(true)
      expect(/^\d{16}$/.test(number)).toBe(true)
      expect(isLuhnValid(number)).toBe(true)
    }
  })

  it("is deterministic when the randomness is", () => {
    const zeros = () => 0
    expect(generateCardNumber(zeros)).toBe(generateCardNumber(zeros))
    expect(isLuhnValid(generateCardNumber(zeros))).toBe(true)
  })
})

describe("luhn", () => {
  it("computes the check digit for known vectors", () => {
    // Appending the check digit must make the whole number valid.
    for (const partial of ["424242424242424", "411111111111111", "79927398713"]) {
      const full = partial + luhnCheckDigit(partial)
      expect(isLuhnValid(full)).toBe(true)
    }
  })

  it("rejects a number with two digits transposed", () => {
    const valid = generateCardNumber()
    const digits = valid.split("")
    // Find a neighbouring pair that actually differs, or the swap is a no-op.
    const i = digits.findIndex((d, idx) => idx > 0 && d !== digits[idx - 1])
    ;[digits[i], digits[i - 1]] = [digits[i - 1], digits[i]]
    expect(isLuhnValid(digits.join(""))).toBe(false)
  })

  it("rejects anything that is not all digits", () => {
    expect(isLuhnValid("4242 4242 4242 4242")).toBe(false)
    expect(isLuhnValid("")).toBe(false)
  })
})

describe("masking", () => {
  it("keeps only the last four", () => {
    expect(lastFour("4242424242424242")).toBe("4242")
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

  it("rejects a transition to the status it is already in", () => {
    expect(canTransition("active", "active")).toBe(false)
    expect(canTransition("frozen", "frozen")).toBe(false)
  })
})

describe("validateIssueInput", () => {
  it("accepts a well-formed request", () => {
    const result = validateIssueInput(validInput, MERCHANT_IDS)
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.value.spendLimit).toBe(25000)
      expect(result.value.categoryLock).toBe("advertising")
    }
  })

  it("trims the nickname and defaults an absent category lock to null", () => {
    const result = validateIssueInput(
      { ...validInput, nickname: "  Vendor tools  ", categoryLock: undefined },
      MERCHANT_IDS,
    )
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.value.nickname).toBe("Vendor tools")
      expect(result.value.categoryLock).toBeNull()
    }
  })

  it("rejects a missing merchant", () => {
    const missing = validateIssueInput(
      { ...validInput, merchantId: "" },
      MERCHANT_IDS,
    )
    expect(missing.ok).toBe(false)

    const unknown = validateIssueInput(
      { ...validInput, merchantId: "mch_99" },
      MERCHANT_IDS,
    )
    expect(unknown.ok).toBe(false)
    if (!unknown.ok) expect(unknown.errors.merchantId).toBeTruthy()
  })

  it("rejects a zero, negative, or oversized limit", () => {
    for (const spendLimit of [0, -1, MAX_SPEND_LIMIT + 1]) {
      const result = validateIssueInput({ ...validInput, spendLimit }, MERCHANT_IDS)
      expect(result.ok).toBe(false)
      if (!result.ok) expect(result.errors.spendLimit).toBeTruthy()
    }
  })

  it("accepts a limit exactly at the ceiling", () => {
    const result = validateIssueInput(
      { ...validInput, spendLimit: MAX_SPEND_LIMIT },
      MERCHANT_IDS,
    )
    expect(result.ok).toBe(true)
  })

  it("rejects a non-integer limit, so floats never reach the store", () => {
    const result = validateIssueInput(
      { ...validInput, spendLimit: 250.5 },
      MERCHANT_IDS,
    )
    expect(result.ok).toBe(false)
  })

  it("rejects a limit that arrived as a string", () => {
    const result = validateIssueInput(
      { ...validInput, spendLimit: "25000" },
      MERCHANT_IDS,
    )
    expect(result.ok).toBe(false)
  })

  it("rejects a currency outside the allowlist", () => {
    for (const currency of ["JPY", "usd", "", null]) {
      const result = validateIssueInput({ ...validInput, currency }, MERCHANT_IDS)
      expect(result.ok).toBe(false)
    }
  })

  it("rejects an unknown category lock", () => {
    const result = validateIssueInput(
      { ...validInput, categoryLock: "gambling" },
      MERCHANT_IDS,
    )
    expect(result.ok).toBe(false)
  })

  it("collects every failure at once rather than stopping at the first", () => {
    const result = validateIssueInput(
      { nickname: "", merchantId: "", spendLimit: -1, currency: "JPY" },
      MERCHANT_IDS,
    )
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(Object.keys(result.errors).sort()).toEqual([
        "currency",
        "merchantId",
        "nickname",
        "spendLimit",
      ])
    }
  })

  it("survives a body that is not an object", () => {
    expect(validateIssueInput(null, MERCHANT_IDS).ok).toBe(false)
    expect(validateIssueInput("nope", MERCHANT_IDS).ok).toBe(false)
  })
})

describe("spendPercent", () => {
  it("reports spend against the limit", () => {
    expect(spendPercent(0, 25000)).toBe(0)
    expect(spendPercent(12500, 25000)).toBe(50)
    expect(spendPercent(25000, 25000)).toBe(100)
  })

  it("clamps overspend rather than overflowing the bar", () => {
    expect(spendPercent(50000, 25000)).toBe(100)
  })

  it("does not divide by zero", () => {
    expect(spendPercent(100, 0)).toBe(0)
  })
})
