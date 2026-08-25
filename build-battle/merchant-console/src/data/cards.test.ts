import { describe, expect, it } from "vitest"
import {
  MAX_SPEND_LIMIT,
  currencyMismatch,
  findRecentDuplicate,
  validateCreateCard,
} from "./cards"

/**
 * The validation allowlists, tested directly rather than through the route.
 * Each of these is a case the ticket names explicitly, so each gets a test
 * that fails loudly if someone loosens the check later.
 */

const valid = {
  nickname: "Ad spend",
  merchantId: "mch_01",
  spendLimit: 25_000,
  currency: "USD",
}

describe("validateCreateCard", () => {
  it("accepts a well-formed payload", () => {
    const result = validateCreateCard(valid)
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.value.spendLimit).toBe(25_000)
      expect(result.value.category).toBeNull()
    }
  })

  it("rejects a missing merchant", () => {
    const result = validateCreateCard({ ...valid, merchantId: undefined })
    expect(result).toMatchObject({ ok: false, error: { field: "merchantId" } })
  })

  it("rejects a merchant that does not exist", () => {
    const result = validateCreateCard({ ...valid, merchantId: "mch_nope" })
    expect(result).toMatchObject({ ok: false, error: { field: "merchantId" } })
  })

  it("rejects a missing nickname", () => {
    const result = validateCreateCard({ ...valid, nickname: "   " })
    expect(result).toMatchObject({ ok: false, error: { field: "nickname" } })
  })

  it("rejects a zero or negative limit", () => {
    for (const spendLimit of [0, -1, -25_000]) {
      const result = validateCreateCard({ ...valid, spendLimit })
      expect(result).toMatchObject({ ok: false, error: { field: "spendLimit" } })
    }
  })

  it("rejects a limit above 5,000,000 minor units but accepts the boundary", () => {
    expect(
      validateCreateCard({ ...valid, spendLimit: MAX_SPEND_LIMIT + 1 }),
    ).toMatchObject({ ok: false, error: { field: "spendLimit" } })
    expect(
      validateCreateCard({ ...valid, spendLimit: MAX_SPEND_LIMIT }).ok,
    ).toBe(true)
  })

  it("rejects a non-integer limit rather than rounding it", () => {
    const result = validateCreateCard({ ...valid, spendLimit: 250.5 })
    expect(result).toMatchObject({ ok: false, error: { field: "spendLimit" } })
  })

  it("rejects any currency outside USD, EUR, GBP", () => {
    for (const currency of ["XYZ", "usd", "", null, 42]) {
      const result = validateCreateCard({ ...valid, currency })
      expect(result).toMatchObject({ ok: false, error: { field: "currency" } })
    }
  })

  it("accepts each allowed currency", () => {
    for (const currency of ["USD", "EUR", "GBP"]) {
      expect(validateCreateCard({ ...valid, currency }).ok).toBe(true)
    }
  })

  it("rejects a category outside the allowlist", () => {
    const result = validateCreateCard({ ...valid, category: "crypto" })
    expect(result).toMatchObject({ ok: false, error: { field: "category" } })
  })

  it("converts a major-unit string to minor units exactly once", () => {
    // The form sends what was typed; the boundary converts it.
    const result = validateCreateCard({ ...valid, spendLimit: "1250.50" })
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.value.spendLimit).toBe(125_050)
  })

  it("treats a whole-number string as minor units already", () => {
    const result = validateCreateCard({ ...valid, spendLimit: "25000" })
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.value.spendLimit).toBe(25_000)
  })

  it("rejects an amount carrying a currency symbol", () => {
    const result = validateCreateCard({ ...valid, spendLimit: "$250.00" })
    expect(result).toMatchObject({ ok: false, error: { field: "spendLimit" } })
  })
})

describe("currencyMismatch", () => {
  it("is silent when the card matches the merchant's currency", () => {
    // mch_01 (Lumen Coffee Roasters) settles in USD.
    expect(currencyMismatch({ merchantId: "mch_01", currency: "USD" })).toBeNull()
  })

  it("warns when the card is in a currency the merchant does not settle in", () => {
    const warning = currencyMismatch({ merchantId: "mch_01", currency: "EUR" })
    expect(warning).toContain("USD")
    expect(warning).toContain("EUR")
  })
})

describe("findRecentDuplicate", () => {
  const input = {
    nickname: "Duplicate probe",
    merchantId: "mch_01",
    spendLimit: 4242,
    currency: "USD" as const,
    category: null,
  }

  it("finds nothing when no matching card exists", () => {
    expect(findRecentDuplicate(input)).toBeNull()
  })

  it("does not treat a card issued long ago as a double-submit", () => {
    // The seeded cards are months old, so nothing in the store should match
    // even if the details lined up.
    const old = {
      ...input,
      nickname: "Google Ads — Q3",
      spendLimit: 500_000,
    }
    expect(findRecentDuplicate(old)).toBeNull()
  })
})
