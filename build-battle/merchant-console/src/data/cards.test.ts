import { describe, expect, it } from "vitest"
import { CARD_CATEGORIES } from "@/lib/cards"
import {
  CARD_CURRENCIES,
  MAX_NICKNAME_LENGTH,
  MAX_SPEND_LIMIT,
  parseCardInput,
} from "./cards"

/**
 * `parseCardInput` is the whole server-side allowlist for issuing a card, and
 * the ticket's sixth criterion is exactly this. Curl proved it end to end; these
 * pin it so a refactor cannot quietly widen what gets through.
 */

const valid = {
  nickname: "Ad spend — Meta",
  merchantId: "mch_01",
  spendLimit: "250.00",
  currency: "USD",
}

const parse = (overrides: Record<string, unknown> = {}) =>
  parseCardInput({ ...valid, ...overrides })

describe("parseCardInput", () => {
  it("accepts a well-formed request and converts to minor units once", () => {
    const result = parse()
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.value.spendLimit).toBe(25000)
    expect(result.value.currency).toBe("USD")
    expect(result.value.categoryLock).toBe("any")
  })

  it("trims the nickname rather than storing the padding", () => {
    const result = parse({ nickname: "  Contractor tools  " })
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.value.nickname).toBe("Contractor tools")
  })

  it("rejects a body that is not an object", () => {
    for (const body of [null, undefined, "nickname", 7, []]) {
      expect(parseCardInput(body).ok).toBe(false)
    }
  })

  describe("merchant", () => {
    it("rejects an unknown or missing merchant", () => {
      expect(parse({ merchantId: "mch_999" }).ok).toBe(false)
      expect(parse({ merchantId: undefined }).ok).toBe(false)
      expect(parse({ merchantId: 1 }).ok).toBe(false)
    })
  })

  describe("nickname", () => {
    it("rejects empty, whitespace-only, and over-long", () => {
      expect(parse({ nickname: "" }).ok).toBe(false)
      expect(parse({ nickname: "   " }).ok).toBe(false)
      expect(parse({ nickname: "x".repeat(MAX_NICKNAME_LENGTH + 1) }).ok).toBe(
        false,
      )
    })

    it("accepts exactly the maximum length", () => {
      expect(parse({ nickname: "x".repeat(MAX_NICKNAME_LENGTH) }).ok).toBe(true)
    })
  })

  describe("spend limit", () => {
    it("rejects zero and negative", () => {
      expect(parse({ spendLimit: "0" }).ok).toBe(false)
      expect(parse({ spendLimit: "0.00" }).ok).toBe(false)
      expect(parse({ spendLimit: "-1" }).ok).toBe(false)
    })

    it("rejects anything that is not an amount string", () => {
      expect(parse({ spendLimit: 250 }).ok).toBe(false)
      expect(parse({ spendLimit: "abc" }).ok).toBe(false)
      expect(parse({ spendLimit: "250.001" }).ok).toBe(false)
      expect(parse({ spendLimit: undefined }).ok).toBe(false)
    })

    it("treats the cap as inclusive, as the ticket words it", () => {
      const atCap = parse({ spendLimit: "50000" })
      expect(atCap.ok).toBe(true)
      if (atCap.ok) expect(atCap.value.spendLimit).toBe(MAX_SPEND_LIMIT)
      expect(parse({ spendLimit: "50000.01" }).ok).toBe(false)
    })
  })

  describe("currency", () => {
    it("accepts every allowed code and rejects the rest", () => {
      for (const code of CARD_CURRENCIES) {
        expect(parse({ currency: code }).ok).toBe(true)
      }
      for (const code of ["JPY", "usd", "", "US"]) {
        expect(parse({ currency: code }).ok).toBe(false)
      }
    })
  })

  describe("category lock", () => {
    it("accepts every allowed category", () => {
      for (const category of CARD_CATEGORIES) {
        const result = parse({ categoryLock: category })
        expect(result.ok).toBe(true)
        if (result.ok) expect(result.value.categoryLock).toBe(category)
      }
    })

    it("defaults to unrestricted when absent", () => {
      const result = parse({ categoryLock: undefined })
      expect(result.ok).toBe(true)
      if (result.ok) expect(result.value.categoryLock).toBe("any")
    })

    it("rejects an unknown category rather than falling back to any", () => {
      expect(parse({ categoryLock: "crypto" }).ok).toBe(false)
      expect(parse({ categoryLock: 3 }).ok).toBe(false)
    })
  })
})
