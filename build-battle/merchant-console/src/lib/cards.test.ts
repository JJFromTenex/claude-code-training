import { describe, expect, it } from "vitest"
import {
  CARD_NUMBER_LENGTH,
  MAX_SPEND_LIMIT,
  TEST_BIN,
  canTransition,
  cardReference,
  generateCardNumber,
  isLuhnValid,
  luhnCheckDigit,
  maskCardNumber,
  spendRatio,
  validateIssueInput,
} from "./cards"

/**
 * A card number that fails Luhn is a support call; one that resembles a real
 * PAN is a much worse day. These pin both, plus the transitions that decide
 * whether a cancelled card can come back.
 */

/** Deterministic stand-in for Math.random, so a failure reproduces. */
function sequence(values: number[]): () => number {
  let i = 0
  return () => values[i++ % values.length]
}

const merchantExists = (id: string) => id === "mch_01"

const validInput = {
  nickname: "Ad spend — Q3",
  merchantId: "mch_01",
  spendLimit: 25000,
  currency: "USD",
  category: null,
}

describe("generateCardNumber", () => {
  it("sits on the 4242 test BIN, so nothing here resembles a real PAN", () => {
    for (let i = 0; i < 50; i++) {
      expect(generateCardNumber().startsWith(TEST_BIN)).toBe(true)
    }
  })

  it("produces a Luhn-valid number every time", () => {
    for (let i = 0; i < 200; i++) {
      expect(isLuhnValid(generateCardNumber())).toBe(true)
    }
  })

  it("is sixteen digits and nothing but digits", () => {
    const number = generateCardNumber()
    expect(number).toHaveLength(CARD_NUMBER_LENGTH)
    expect(number).toMatch(/^\d{16}$/)
  })

  it("is deterministic when its randomness is", () => {
    const digits = sequence([0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 0, 0.15])
    const first = generateCardNumber(digits)
    const second = generateCardNumber(
      sequence([0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 0, 0.15]),
    )
    expect(first).toBe(second)
    expect(isLuhnValid(first)).toBe(true)
  })
})

describe("luhnCheckDigit", () => {
  it("completes a known number", () => {
    // 4242424242424242 is the canonical test card; drop its check digit and
    // the function should hand it back.
    expect(luhnCheckDigit("424242424242424")).toBe(2)
  })

  it("rejects a number one digit off", () => {
    expect(isLuhnValid("4242424242424243")).toBe(false)
  })

  it("rejects anything that is not digits", () => {
    expect(isLuhnValid("4242-4242-4242-4242")).toBe(false)
  })
})

describe("maskCardNumber", () => {
  it("shows the last four and nothing else", () => {
    expect(maskCardNumber("4242")).toBe("•••• 4242")
    expect(maskCardNumber("1881")).toBe("•••• 1881")
  })
})

describe("cardReference", () => {
  it("is an opaque handle, never the number itself", () => {
    const reference = cardReference(sequence([0.1]))
    expect(reference).toMatch(/^crd_ref_\d{12}$/)
  })
})

describe("canTransition", () => {
  it("freezes and unfreezes an active card", () => {
    expect(canTransition("active", "frozen")).toBe(true)
    expect(canTransition("frozen", "active")).toBe(true)
  })

  it("cancels from either live state", () => {
    expect(canTransition("active", "cancelled")).toBe(true)
    expect(canTransition("frozen", "cancelled")).toBe(true)
  })

  it("never brings a cancelled card back", () => {
    expect(canTransition("cancelled", "active")).toBe(false)
    expect(canTransition("cancelled", "frozen")).toBe(false)
    expect(canTransition("cancelled", "cancelled")).toBe(false)
  })

  it("does not treat a no-op as a transition", () => {
    expect(canTransition("active", "active")).toBe(false)
    expect(canTransition("frozen", "frozen")).toBe(false)
  })
})

describe("validateIssueInput", () => {
  it("accepts a well-formed request", () => {
    const result = validateIssueInput(validInput, merchantExists)
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.value.spendLimit).toBe(25000)
  })

  it("rejects a missing or unknown merchant", () => {
    expect(
      validateIssueInput({ ...validInput, merchantId: "" }, merchantExists),
    ).toMatchObject({ ok: false })
    expect(
      validateIssueInput({ ...validInput, merchantId: "mch_nope" }, merchantExists),
    ).toMatchObject({ ok: false })
  })

  it("rejects a zero or negative limit", () => {
    expect(
      validateIssueInput({ ...validInput, spendLimit: 0 }, merchantExists),
    ).toMatchObject({ ok: false })
    expect(
      validateIssueInput({ ...validInput, spendLimit: -2500 }, merchantExists),
    ).toMatchObject({ ok: false })
  })

  it("rejects a limit above the ceiling but allows the ceiling itself", () => {
    expect(
      validateIssueInput(
        { ...validInput, spendLimit: MAX_SPEND_LIMIT + 1 },
        merchantExists,
      ),
    ).toMatchObject({ ok: false })
    expect(
      validateIssueInput(
        { ...validInput, spendLimit: MAX_SPEND_LIMIT },
        merchantExists,
      ).ok,
    ).toBe(true)
  })

  it("rejects a limit that is not whole minor units", () => {
    expect(
      validateIssueInput({ ...validInput, spendLimit: 250.5 }, merchantExists),
    ).toMatchObject({ ok: false })
    expect(
      validateIssueInput({ ...validInput, spendLimit: "25000" }, merchantExists),
    ).toMatchObject({ ok: false })
  })

  it("rejects a currency outside USD, EUR, GBP", () => {
    expect(
      validateIssueInput({ ...validInput, currency: "JPY" }, merchantExists),
    ).toMatchObject({ ok: false })
  })

  it("rejects a nickname that is missing or only whitespace", () => {
    expect(
      validateIssueInput({ ...validInput, nickname: "   " }, merchantExists),
    ).toMatchObject({ ok: false })
  })

  it("rejects a category outside the allowlist, and allows none", () => {
    expect(
      validateIssueInput({ ...validInput, category: "laundering" }, merchantExists),
    ).toMatchObject({ ok: false })
    expect(
      validateIssueInput({ ...validInput, category: "software" }, merchantExists).ok,
    ).toBe(true)
  })
})

describe("spendRatio", () => {
  it("reports spend against the limit", () => {
    expect(spendRatio({ spend: 20000, spendLimit: 25000 })).toBe(0.8)
  })

  it("clamps an overspent card rather than exceeding the bar", () => {
    expect(spendRatio({ spend: 30000, spendLimit: 25000 })).toBe(1)
  })

  it("does not divide by a zero limit", () => {
    expect(spendRatio({ spend: 100, spendLimit: 0 })).toBe(0)
  })
})
