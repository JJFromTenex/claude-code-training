import { describe, expect, it } from "vitest"
import { MAX_SPEND_LIMIT, parseIssueCardInput } from "./cards"

const valid = {
  merchantId: "mch_01",
  nickname: "Meta ads",
  category: "advertising",
  spendLimit: 25000,
  currency: "USD",
}

describe("parseIssueCardInput", () => {
  it("accepts a well-formed body", () => {
    const result = parseIssueCardInput(valid)
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.value.spendLimit).toBe(25000)
  })

  it("rejects a missing merchant", () => {
    expect(parseIssueCardInput({ ...valid, merchantId: "" }).ok).toBe(false)
    expect(parseIssueCardInput({ ...valid, merchantId: undefined }).ok).toBe(false)
    expect(parseIssueCardInput({ ...valid, merchantId: "mch_99" }).ok).toBe(false)
  })

  it("rejects a zero or negative limit", () => {
    expect(parseIssueCardInput({ ...valid, spendLimit: 0 }).ok).toBe(false)
    expect(parseIssueCardInput({ ...valid, spendLimit: -100 }).ok).toBe(false)
  })

  it("rejects a limit above 5,000,000 minor units", () => {
    expect(parseIssueCardInput({ ...valid, spendLimit: MAX_SPEND_LIMIT }).ok).toBe(true)
    expect(parseIssueCardInput({ ...valid, spendLimit: MAX_SPEND_LIMIT + 1 }).ok).toBe(false)
  })

  it("rejects a non-integer limit — money is integer minor units", () => {
    expect(parseIssueCardInput({ ...valid, spendLimit: 250.0 }).ok).toBe(true)
    expect(parseIssueCardInput({ ...valid, spendLimit: 250.5 }).ok).toBe(false)
    expect(parseIssueCardInput({ ...valid, spendLimit: "25000" }).ok).toBe(false)
    expect(parseIssueCardInput({ ...valid, spendLimit: "$250.00" }).ok).toBe(false)
  })

  it("rejects any currency outside USD, EUR, GBP", () => {
    expect(parseIssueCardInput({ ...valid, currency: "CAD" }).ok).toBe(false)
    expect(parseIssueCardInput({ ...valid, currency: "usd" }).ok).toBe(false)
    expect(parseIssueCardInput({ ...valid, currency: "EUR" }).ok).toBe(true)
    expect(parseIssueCardInput({ ...valid, currency: "GBP" }).ok).toBe(true)
  })

  it("rejects an unknown category and defaults a missing one to any", () => {
    expect(parseIssueCardInput({ ...valid, category: "gambling" }).ok).toBe(false)
    const result = parseIssueCardInput({ ...valid, category: undefined })
    expect(result.ok && result.value.category).toBe("any")
  })

  it("rejects a non-object body", () => {
    expect(parseIssueCardInput(null).ok).toBe(false)
    expect(parseIssueCardInput("x").ok).toBe(false)
  })
})
