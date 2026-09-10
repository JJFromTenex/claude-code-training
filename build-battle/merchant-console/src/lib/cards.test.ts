import { describe, expect, it } from "vitest"
import {
  CARD_BIN,
  MAX_SPEND_LIMIT,
  canTransition,
  generateCardNumber,
  isLuhnValid,
  issueCard,
  luhnCheckDigit,
  maskCard,
  spendPercent,
  transition,
  validateCardInput,
} from "./cards"

/**
 * A card number that fails Luhn is rejected by every downstream system, and a
 * number that is not on the 4242 BIN is one that could resemble a real PAN.
 * The state machine matters for the same reason: a cancelled card that can be
 * revived is a spending control that does not control spending.
 */

const MERCHANT_IDS = ["mch_01", "mch_02"]

/** Independent Luhn implementation, so the test does not confirm its own bug. */
function luhnPasses(number: string): boolean {
  const digits = number.split("").reverse().map(Number)
  const sum = digits.reduce((total, digit, index) => {
    if (index % 2 === 0) return total + digit
    const doubled = digit * 2
    return total + (doubled > 9 ? doubled - 9 : doubled)
  }, 0)
  return sum % 10 === 0
}

describe("generateCardNumber", () => {
  it("starts on the 4242 test BIN, so nothing resembles a real card", () => {
    for (let i = 0; i < 50; i++) {
      expect(generateCardNumber().startsWith(CARD_BIN)).toBe(true)
    }
  })

  it("is sixteen digits", () => {
    const number = generateCardNumber()
    expect(number).toMatch(/^\d{16}$/)
  })

  it("carries a valid Luhn check digit", () => {
    for (let i = 0; i < 50; i++) {
      const number = generateCardNumber()
      // Checked against an independent implementation, not our own luhnSum.
      expect(luhnPasses(number)).toBe(true)
      expect(isLuhnValid(number)).toBe(true)
    }
  })

  it("fails Luhn if a digit is altered", () => {
    const number = generateCardNumber()
    const tampered =
      number.slice(0, 5) + ((Number(number[5]) + 1) % 10) + number.slice(6)
    expect(luhnPasses(tampered)).toBe(false)
  })

  it("is deterministic given a fixed random source", () => {
    const fixed = () => 0.5
    expect(generateCardNumber(fixed)).toBe(generateCardNumber(fixed))
  })
})

describe("luhnCheckDigit", () => {
  it("completes a known number", () => {
    // 424242424242424 + check digit 2 is the canonical test card.
    expect(luhnCheckDigit("424242424242424")).toBe(2)
  })
})

describe("maskCard", () => {
  it("renders the last four and nothing else", () => {
    expect(maskCard("4242")).toBe("•••• 4242")
  })
})

describe("transition", () => {
  it("freezes and unfreezes an active card", () => {
    expect(transition("active", "frozen")).toEqual({ ok: true, value: "frozen" })
    expect(transition("frozen", "active")).toEqual({ ok: true, value: "active" })
  })

  it("cancels from either active or frozen", () => {
    expect(transition("active", "cancelled")).toMatchObject({ ok: true })
    expect(transition("frozen", "cancelled")).toMatchObject({ ok: true })
  })

  it("treats cancelled as terminal", () => {
    expect(transition("cancelled", "active")).toMatchObject({ ok: false })
    expect(transition("cancelled", "frozen")).toMatchObject({ ok: false })
    expect(canTransition("cancelled", "active")).toBe(false)
  })

  it("refuses a no-op rather than pretending it worked", () => {
    expect(transition("active", "active")).toMatchObject({ ok: false })
  })
})

describe("validateCardInput", () => {
  const valid = {
    nickname: "Ad spend",
    merchantId: "mch_01",
    spendLimit: 25000,
    currency: "USD",
    category: "advertising",
  }

  it("accepts a well-formed card", () => {
    expect(validateCardInput(valid, MERCHANT_IDS)).toEqual({
      ok: true,
      value: { ...valid },
    })
  })

  it("rejects a missing or unknown merchant", () => {
    expect(
      validateCardInput({ ...valid, merchantId: undefined }, MERCHANT_IDS),
    ).toMatchObject({ ok: false })
    expect(
      validateCardInput({ ...valid, merchantId: "mch_nope" }, MERCHANT_IDS),
    ).toMatchObject({ ok: false })
  })

  it("rejects a zero or negative spend limit", () => {
    expect(
      validateCardInput({ ...valid, spendLimit: 0 }, MERCHANT_IDS),
    ).toMatchObject({ ok: false })
    expect(
      validateCardInput({ ...valid, spendLimit: -1 }, MERCHANT_IDS),
    ).toMatchObject({ ok: false })
  })

  it("rejects a limit above the cap but accepts the cap itself", () => {
    expect(
      validateCardInput(
        { ...valid, spendLimit: MAX_SPEND_LIMIT + 1 },
        MERCHANT_IDS,
      ),
    ).toMatchObject({ ok: false })
    expect(
      validateCardInput({ ...valid, spendLimit: MAX_SPEND_LIMIT }, MERCHANT_IDS),
    ).toMatchObject({ ok: true })
  })

  it("rejects a limit that is not an integer, so no float money gets in", () => {
    expect(
      validateCardInput({ ...valid, spendLimit: 250.5 }, MERCHANT_IDS),
    ).toMatchObject({ ok: false })
    expect(
      validateCardInput({ ...valid, spendLimit: "25000" }, MERCHANT_IDS),
    ).toMatchObject({ ok: false })
  })

  it("rejects a currency outside USD, EUR, GBP", () => {
    expect(
      validateCardInput({ ...valid, currency: "JPY" }, MERCHANT_IDS),
    ).toMatchObject({ ok: false })
  })

  it("rejects an empty nickname", () => {
    expect(
      validateCardInput({ ...valid, nickname: "   " }, MERCHANT_IDS),
    ).toMatchObject({ ok: false })
  })

  it("falls back to the 'any' category rather than failing", () => {
    const parsed = validateCardInput(
      { ...valid, category: "nonsense" },
      MERCHANT_IDS,
    )
    expect(parsed.ok && parsed.value.category).toBe("any")
  })
})

describe("issueCard", () => {
  const input = {
    nickname: "Ad spend",
    merchantId: "mch_01",
    spendLimit: 25000,
    currency: "USD" as const,
    category: "advertising" as const,
  }

  it("keeps the full number off the record, so it cannot leak", () => {
    const { card, fullNumber } = issueCard(input, {
      id: "card_0001",
      now: new Date("2026-09-10T12:00:00.000Z"),
    })

    expect(fullNumber).toMatch(/^\d{16}$/)
    expect(card.last4).toBe(fullNumber.slice(-4))
    // The number must not appear anywhere on the serialized record.
    expect(JSON.stringify(card)).not.toContain(fullNumber)
  })

  it("starts active with nothing spent, and stamps UTC", () => {
    const { card } = issueCard(input, {
      id: "card_0001",
      now: new Date("2026-09-10T23:30:00.000Z"),
    })
    expect(card.status).toBe("active")
    expect(card.spent).toBe(0)
    expect(card.createdAt).toBe("2026-09-10T23:30:00.000Z")
  })
})

describe("spendPercent", () => {
  it("reports spend against the limit", () => {
    expect(spendPercent({ spent: 0, spendLimit: 25000 })).toBe(0)
    expect(spendPercent({ spent: 20000, spendLimit: 25000 })).toBe(80)
    expect(spendPercent({ spent: 23000, spendLimit: 25000 })).toBe(92)
  })

  it("clamps over-limit spend rather than reporting past 100", () => {
    expect(spendPercent({ spent: 30000, spendLimit: 25000 })).toBe(100)
  })

  it("does not divide by zero", () => {
    expect(spendPercent({ spent: 100, spendLimit: 0 })).toBe(0)
  })
})
