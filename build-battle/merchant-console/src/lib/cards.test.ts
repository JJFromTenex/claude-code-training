import { describe, expect, it } from "vitest"
import { Currency, Payment } from "@/data/types"
import {
  canTransition,
  generateCardNumber,
  isLuhnValid,
  lastFour,
  luhnCheckDigit,
  maskCardNumber,
  MAX_SPEND_LIMIT,
  spendForCard,
  TEST_BIN,
  validateIssueInput,
} from "./cards"

/**
 * A card number that fails Luhn, or a status that goes backwards out of
 * cancelled, is the kind of defect nothing on screen reveals. These cover the
 * parts that are wrong silently.
 */

/** Deterministic digit source, so a generated number can be asserted exactly. */
function digits(sequence: number[]): () => number {
  let index = 0
  return () => sequence[index++ % sequence.length] / 10
}

const merchantCurrency = (id: string): Currency | undefined =>
  ({ mch_01: "USD", mch_04: "GBP" }) [id] as Currency | undefined

const context = { merchantCurrency }

function issueInput(overrides: Record<string, unknown> = {}) {
  return {
    nickname: "Ad spend — Q3",
    merchantId: "mch_01",
    spendLimit: 25000,
    currency: "USD",
    categoryLock: null,
    ...overrides,
  }
}

describe("isLuhnValid", () => {
  it("accepts a number whose check digit completes it", () => {
    expect(isLuhnValid("4242424242424242")).toBe(true)
  })

  it("rejects the same number with one digit changed", () => {
    expect(isLuhnValid("4242424242424243")).toBe(false)
  })

  it("rejects anything that is not all digits", () => {
    expect(isLuhnValid("4242-4242-4242-4242")).toBe(false)
    expect(isLuhnValid("")).toBe(false)
  })
})

describe("luhnCheckDigit", () => {
  it("returns the digit that makes the whole number valid", () => {
    const partial = "424242424242424"
    expect(isLuhnValid(partial + luhnCheckDigit(partial))).toBe(true)
  })
})

describe("generateCardNumber", () => {
  it("puts every number on the test BIN, so none can resemble a real PAN", () => {
    for (let seed = 0; seed < 50; seed++) {
      const number = generateCardNumber(digits([seed % 10, 3, 7, 1, 9, 4]))
      expect(number.startsWith(TEST_BIN)).toBe(true)
    }
  })

  it("generates sixteen digits that pass an independent Luhn check", () => {
    for (let seed = 0; seed < 50; seed++) {
      const number = generateCardNumber(digits([seed % 10, 8, 2, 6, 0, 5]))
      expect(number).toMatch(/^\d{16}$/)
      expect(isLuhnValid(number)).toBe(true)
    }
  })

  it("can force the last four, which is how seed cards link to payments", () => {
    const number = generateCardNumber(digits([1, 2, 3, 4, 5, 6, 7, 8, 9, 0]), "8840")
    expect(number.endsWith("8840")).toBe(true)
    expect(number.startsWith(TEST_BIN)).toBe(true)
    expect(isLuhnValid(number)).toBe(true)
  })

  it("always finds a number for a forced ending, whatever the source gives it", () => {
    // Regression guard: the first version re-rolled the whole body ten times
    // and threw when none of them landed, which failed about a third of runs.
    for (let attempt = 0; attempt < 500; attempt++) {
      const ending = String(attempt % 10000).padStart(4, "0")
      const number = generateCardNumber(Math.random, ending)
      expect(number.endsWith(ending)).toBe(true)
      expect(isLuhnValid(number)).toBe(true)
    }
  })

  it("refuses a forced ending that is not four digits", () => {
    expect(() => generateCardNumber(Math.random, "88")).toThrow()
    expect(() => generateCardNumber(Math.random, "88a0")).toThrow()
  })
})

describe("maskCardNumber", () => {
  it("is the only shape a number takes outside the creation response", () => {
    expect(maskCardNumber("4242")).toBe("•••• 4242")
    expect(maskCardNumber(lastFour("4242424242428840"))).toBe("•••• 8840")
  })
})

describe("canTransition", () => {
  it("lets a card freeze and come back", () => {
    expect(canTransition("active", "frozen")).toBe(true)
    expect(canTransition("frozen", "active")).toBe(true)
  })

  it("lets either live status cancel", () => {
    expect(canTransition("active", "cancelled")).toBe(true)
    expect(canTransition("frozen", "cancelled")).toBe(true)
  })

  it("makes cancelled terminal — nothing comes back from it", () => {
    expect(canTransition("cancelled", "active")).toBe(false)
    expect(canTransition("cancelled", "frozen")).toBe(false)
    expect(canTransition("cancelled", "cancelled")).toBe(false)
  })

  it("refuses a transition to the status a card already has", () => {
    expect(canTransition("active", "active")).toBe(false)
    expect(canTransition("frozen", "frozen")).toBe(false)
  })
})

describe("spendForCard", () => {
  const payment = (over: Partial<Payment>): Payment => ({
    id: "pay_0001",
    merchantId: "mch_01",
    amount: 5000,
    currency: "USD",
    status: "captured",
    method: "card",
    cardBrand: "visa",
    last4: "8840",
    createdAt: "2026-08-01T00:00:00.000Z",
    description: "Wholesale invoice",
    ...over,
  })

  const card = { merchantId: "mch_01", currency: "USD" as Currency, last4: "8840" }

  it("sums captured payments on the same merchant, currency and last four", () => {
    expect(spendForCard([payment({}), payment({ id: "pay_0002" })], card)).toBe(10000)
  })

  it("ignores payments that were never captured", () => {
    expect(spendForCard([payment({ status: "failed" })], card)).toBe(0)
    expect(spendForCard([payment({ status: "refunded" })], card)).toBe(0)
  })

  it("never mixes currencies, even on the same last four", () => {
    expect(spendForCard([payment({ currency: "EUR" })], card)).toBe(0)
  })

  it("is honestly zero for a card nothing has been spent on", () => {
    expect(spendForCard([payment({ last4: "0000" })], card)).toBe(0)
    expect(spendForCard([], card)).toBe(0)
  })
})

describe("validateIssueInput", () => {
  const reject = (input: Record<string, unknown>) => {
    const result = validateIssueInput(input, context)
    if (result.ok) throw new Error("expected the input to be refused")
    return result.errors.map((error) => error.field)
  }

  it("accepts a well-formed request", () => {
    const result = validateIssueInput(issueInput(), context)
    expect(result.ok).toBe(true)
  })

  it("refuses a missing merchant", () => {
    expect(reject(issueInput({ merchantId: "" }))).toContain("merchantId")
    expect(reject(issueInput({ merchantId: "mch_99" }))).toContain("merchantId")
  })

  it("refuses a zero or negative spend limit", () => {
    expect(reject(issueInput({ spendLimit: 0 }))).toContain("spendLimit")
    expect(reject(issueInput({ spendLimit: -1 }))).toContain("spendLimit")
  })

  it("refuses a limit above five million minor units, but allows the ceiling", () => {
    expect(reject(issueInput({ spendLimit: MAX_SPEND_LIMIT + 1 }))).toContain(
      "spendLimit",
    )
    const atCeiling = validateIssueInput(
      issueInput({ spendLimit: MAX_SPEND_LIMIT }),
      context,
    )
    expect(atCeiling.ok).toBe(true)
  })

  it("refuses a limit that is not an integer, because money is minor units", () => {
    expect(reject(issueInput({ spendLimit: 250.5 }))).toContain("spendLimit")
    expect(reject(issueInput({ spendLimit: "25000" }))).toContain("spendLimit")
  })

  it("refuses a currency outside USD, EUR and GBP", () => {
    expect(reject(issueInput({ currency: "JPY" }))).toContain("currency")
    expect(reject(issueInput({ currency: 840 }))).toContain("currency")
  })

  it("refuses a currency the merchant does not settle in", () => {
    expect(reject(issueInput({ merchantId: "mch_04", currency: "USD" }))).toContain(
      "currency",
    )
  })

  it("refuses a blank nickname", () => {
    expect(reject(issueInput({ nickname: "   " }))).toContain("nickname")
    expect(reject(issueInput({ nickname: 42 }))).toContain("nickname")
  })

  it("refuses a category that is not on the list", () => {
    expect(reject(issueInput({ categoryLock: "crypto" }))).toContain("categoryLock")
  })

  it("treats an absent category as no lock rather than an error", () => {
    const result = validateIssueInput(issueInput({ categoryLock: "" }), context)
    expect(result.ok && result.value.categoryLock).toBe(null)
  })

  it("reports every problem at once, so the form fills in one pass", () => {
    expect(reject(issueInput({ nickname: "", spendLimit: 0, currency: "JPY" })))
      .toEqual(expect.arrayContaining(["nickname", "spendLimit", "currency"]))
  })
})
