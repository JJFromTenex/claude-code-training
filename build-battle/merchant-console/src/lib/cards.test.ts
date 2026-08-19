import { describe, expect, it } from "vitest"
import {
  CARD_TRANSITIONS,
  canTransition,
  generateCardNumber,
  isValidLuhn,
  luhnCheckDigit,
  maskNumber,
  MAX_LIMIT_MINOR,
  TEST_BIN,
  validateIssueInput,
} from "./cards"

/**
 * The rules in .claude/rules/cards.md, as tests. Every generated number must
 * look like a test card and nothing else; the state machine must refuse what
 * the UI might otherwise allow.
 */

describe("luhnCheckDigit / isValidLuhn", () => {
  it("reproduces known check digits", () => {
    // 4242 4242 4242 4242 is the canonical test number; its last digit is the check.
    expect(luhnCheckDigit("424242424242424")).toBe("2")
    expect(isValidLuhn("4242424242424242")).toBe(true)
  })

  it("rejects a number whose check digit is off by one", () => {
    expect(isValidLuhn("4242424242424243")).toBe(false)
  })

  it("rejects non-digits and too-short input", () => {
    expect(isValidLuhn("4242-4242")).toBe(false)
    expect(isValidLuhn("4")).toBe(false)
  })
})

describe("generateCardNumber", () => {
  it("is 16 digits, starts with the test BIN, and passes Luhn — every time", () => {
    for (let i = 0; i < 500; i++) {
      const n = generateCardNumber()
      expect(n).toMatch(/^\d{16}$/)
      expect(n.startsWith(TEST_BIN)).toBe(true)
      expect(isValidLuhn(n)).toBe(true)
    }
  })

  it("is deterministic given a seeded random source", () => {
    let i = 0
    const seq = () => ((i++ * 7919) % 100) / 100
    const a = generateCardNumber(seq)
    i = 0
    const b = generateCardNumber(seq)
    expect(a).toBe(b)
  })
})

describe("maskNumber", () => {
  it("shows only the last four", () => {
    expect(maskNumber("4242")).toBe("•••• 4242")
  })
})

describe("status state machine", () => {
  it("allows active ⇄ frozen and either → cancelled", () => {
    expect(canTransition("active", "frozen")).toBe(true)
    expect(canTransition("frozen", "active")).toBe(true)
    expect(canTransition("active", "cancelled")).toBe(true)
    expect(canTransition("frozen", "cancelled")).toBe(true)
  })

  it("treats cancelled as terminal", () => {
    expect(CARD_TRANSITIONS.cancelled).toEqual([])
    expect(canTransition("cancelled", "active")).toBe(false)
    expect(canTransition("cancelled", "frozen")).toBe(false)
  })

  it("does not allow a no-op transition to count as a change", () => {
    expect(canTransition("active", "active")).toBe(false)
    expect(canTransition("frozen", "frozen")).toBe(false)
  })
})

describe("validateIssueInput", () => {
  const merchants = ["mch_01", "mch_02"]
  const good = { merchantId: "mch_01", nickname: "Ads", limit: 25000, currency: "USD", category: "advertising" }

  it("accepts a well-formed request", () => {
    const r = validateIssueInput(good, merchants)
    expect(r.ok).toBe(true)
    if (r.ok) expect(r.value.limit).toBe(25000)
  })

  it("rejects a missing or unknown merchant", () => {
    expect(validateIssueInput({ ...good, merchantId: "" }, merchants)).toMatchObject({ ok: false })
    expect(validateIssueInput({ ...good, merchantId: "mch_99" }, merchants)).toMatchObject({ ok: false })
  })

  it("rejects zero, negative, fractional, and over-ceiling limits", () => {
    expect(validateIssueInput({ ...good, limit: 0 }, merchants)).toMatchObject({ ok: false })
    expect(validateIssueInput({ ...good, limit: -1 }, merchants)).toMatchObject({ ok: false })
    expect(validateIssueInput({ ...good, limit: 250.5 }, merchants)).toMatchObject({ ok: false })
    expect(validateIssueInput({ ...good, limit: MAX_LIMIT_MINOR + 1 }, merchants)).toMatchObject({ ok: false })
    expect(validateIssueInput({ ...good, limit: MAX_LIMIT_MINOR }, merchants)).toMatchObject({ ok: true })
  })

  it("rejects a currency outside the allowlist and a dollar-string limit", () => {
    expect(validateIssueInput({ ...good, currency: "JPY" }, merchants)).toMatchObject({ ok: false })
    expect(validateIssueInput({ ...good, limit: "$250.00" }, merchants)).toMatchObject({ ok: false })
  })

  it("defaults the category and rejects an unknown one", () => {
    const r = validateIssueInput({ ...good, category: undefined }, merchants)
    expect(r.ok && r.value.category).toBe("general")
    expect(validateIssueInput({ ...good, category: "crypto" }, merchants)).toMatchObject({ ok: false })
  })
})
