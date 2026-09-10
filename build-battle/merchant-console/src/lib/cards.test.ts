import { describe, expect, it } from "vitest"
import {
  CARD_BIN,
  CARD_NUMBER_LENGTH,
  MAX_SPEND_LIMIT,
  canTransition,
  formatCardNumber,
  generateCardNumber,
  isCardStatus,
  isLuhnValid,
  lastFour,
  luhnCheckDigit,
  maskCardNumber,
  parseCardDraft,
} from "./cards"

/**
 * The card number is the part of this feature that cannot be wrong: a number
 * that fails Luhn is a support ticket, and a number outside the 4242 test BIN
 * is a compliance incident. The status machine is the other: a cancelled card
 * that comes back is money someone did not expect to spend.
 */

/** Deterministic digit source, so a failure reproduces. */
const sequence = (digits: number[]) => {
  let i = 0
  return () => digits[i++ % digits.length] / 10
}

describe("luhnCheckDigit", () => {
  it("completes a payload into a number that passes Luhn", () => {
    const payload = "424212345678901"
    const full = `${payload}${luhnCheckDigit(payload)}`
    expect(isLuhnValid(full)).toBe(true)
  })

  it("matches the textbook example", () => {
    // 7992739871 + check digit 3 is the canonical Luhn worked example.
    expect(luhnCheckDigit("7992739871")).toBe(3)
  })

  it("rejects a number whose check digit is wrong", () => {
    const payload = "424212345678901"
    const wrong = (luhnCheckDigit(payload) + 1) % 10
    expect(isLuhnValid(`${payload}${wrong}`)).toBe(false)
  })
})

describe("generateCardNumber", () => {
  it("starts with the 4242 test BIN", () => {
    expect(generateCardNumber(sequence([7]))).toMatch(
      new RegExp(`^${CARD_BIN}`),
    )
  })

  it("is sixteen digits and passes Luhn", () => {
    const number = generateCardNumber(sequence([1, 9, 3, 0, 5, 8]))
    expect(number).toHaveLength(CARD_NUMBER_LENGTH)
    expect(number).toMatch(/^\d{16}$/)
    expect(isLuhnValid(number)).toBe(true)
  })

  it("holds for every digit source, not just a lucky one", () => {
    for (let seed = 0; seed < 200; seed++) {
      const number = generateCardNumber(() => ((seed * 7919) % 10) / 10)
      expect(number.startsWith(CARD_BIN)).toBe(true)
      expect(isLuhnValid(number)).toBe(true)
    }
  })
})

describe("masking", () => {
  it("shows only the last four", () => {
    const number = generateCardNumber(sequence([4]))
    expect(maskCardNumber(lastFour(number))).toBe(`•••• ${number.slice(-4)}`)
  })

  it("never leaks the middle digits", () => {
    const number = "4242123456789010"
    expect(maskCardNumber(lastFour(number))).not.toContain("12345678")
  })

  it("groups the full number in fours for the one-time reveal", () => {
    expect(formatCardNumber("4242123456789010")).toBe("4242 1234 5678 9010")
  })
})

describe("status machine", () => {
  it("moves active and frozen back and forth", () => {
    expect(canTransition("active", "frozen")).toBe(true)
    expect(canTransition("frozen", "active")).toBe(true)
  })

  it("lets either state cancel", () => {
    expect(canTransition("active", "cancelled")).toBe(true)
    expect(canTransition("frozen", "cancelled")).toBe(true)
  })

  it("treats cancelled as terminal", () => {
    expect(canTransition("cancelled", "active")).toBe(false)
    expect(canTransition("cancelled", "frozen")).toBe(false)
    expect(canTransition("cancelled", "cancelled")).toBe(false)
  })

  it("recognises only the three real statuses", () => {
    expect(isCardStatus("active")).toBe(true)
    expect(isCardStatus("expired")).toBe(false)
  })
})

describe("parseCardDraft", () => {
  const exists = (id: string) => id === "mch_01"
  const valid = {
    nickname: "Ad spend — Meta",
    merchantId: "mch_01",
    spendLimit: 250000,
    currency: "USD",
  }

  const reject = (patch: Record<string, unknown>) =>
    parseCardDraft({ ...valid, ...patch }, exists)

  it("accepts a well-formed request and trims the nickname", () => {
    const result = parseCardDraft({ ...valid, nickname: "  Cloud  " }, exists)
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.value.nickname).toBe("Cloud")
  })

  it("rejects a missing merchant", () => {
    expect(reject({ merchantId: "" }).ok).toBe(false)
    expect(reject({ merchantId: undefined }).ok).toBe(false)
  })

  it("rejects a merchant that does not exist", () => {
    expect(reject({ merchantId: "mch_nope" }).ok).toBe(false)
  })

  it("rejects a zero or negative limit", () => {
    expect(reject({ spendLimit: 0 }).ok).toBe(false)
    expect(reject({ spendLimit: -1 }).ok).toBe(false)
  })

  it("rejects a limit above the cap, and accepts the cap itself", () => {
    expect(reject({ spendLimit: MAX_SPEND_LIMIT + 1 }).ok).toBe(false)
    expect(reject({ spendLimit: MAX_SPEND_LIMIT }).ok).toBe(true)
  })

  it("rejects a limit that is not integer minor units", () => {
    expect(reject({ spendLimit: 250.5 }).ok).toBe(false)
    expect(reject({ spendLimit: "25000" }).ok).toBe(false)
  })

  it("rejects a currency outside USD, EUR, and GBP", () => {
    expect(reject({ currency: "JPY" }).ok).toBe(false)
    expect(reject({ currency: "usd" }).ok).toBe(false)
    expect(reject({ currency: "EUR" }).ok).toBe(true)
    expect(reject({ currency: "GBP" }).ok).toBe(true)
  })

  it("rejects a missing nickname", () => {
    expect(reject({ nickname: "   " }).ok).toBe(false)
  })

  it("rejects a body that is not an object", () => {
    expect(parseCardDraft(null, exists).ok).toBe(false)
    expect(parseCardDraft("card", exists).ok).toBe(false)
  })
})
