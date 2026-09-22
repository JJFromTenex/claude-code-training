import { describe, expect, it } from "vitest"
import { parseCardStatus, parseIssueCardInput } from "./cards"

/**
 * The server does not trust the client. Every rejection the ticket names has
 * a case here, so the route handler can stay a thin wrapper.
 */

const good = {
  nickname: "Ad spend",
  merchantId: "mch_01",
  spendLimit: 25000,
  currency: "USD",
  category: "advertising",
}

describe("parseIssueCardInput", () => {
  it("accepts a well-formed request in minor units", () => {
    const result = parseIssueCardInput(good)
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.value.spendLimit).toBe(25000)
  })

  it("rejects a missing or unknown merchant", () => {
    expect(parseIssueCardInput({ ...good, merchantId: undefined }).ok).toBe(
      false,
    )
    expect(parseIssueCardInput({ ...good, merchantId: "mch_99" }).ok).toBe(
      false,
    )
  })

  it("rejects a zero or negative limit", () => {
    expect(parseIssueCardInput({ ...good, spendLimit: 0 }).ok).toBe(false)
    expect(parseIssueCardInput({ ...good, spendLimit: -1 }).ok).toBe(false)
  })

  it("rejects a limit above 5,000,000 minor units and accepts the cap", () => {
    expect(parseIssueCardInput({ ...good, spendLimit: 5_000_001 }).ok).toBe(
      false,
    )
    expect(parseIssueCardInput({ ...good, spendLimit: 5_000_000 }).ok).toBe(
      true,
    )
  })

  it("rejects a limit that is not an integer, including strings", () => {
    expect(parseIssueCardInput({ ...good, spendLimit: 250.5 }).ok).toBe(false)
    expect(parseIssueCardInput({ ...good, spendLimit: "25000" }).ok).toBe(false)
  })

  it("rejects any currency outside USD, EUR, GBP", () => {
    expect(parseIssueCardInput({ ...good, currency: "JPY" }).ok).toBe(false)
    expect(parseIssueCardInput({ ...good, currency: "usd" }).ok).toBe(false)
    expect(parseIssueCardInput({ ...good, currency: "EUR" }).ok).toBe(true)
  })

  it("rejects a blank nickname and trims the rest", () => {
    expect(parseIssueCardInput({ ...good, nickname: "   " }).ok).toBe(false)
    const result = parseIssueCardInput({ ...good, nickname: "  Figma  " })
    if (result.ok) expect(result.value.nickname).toBe("Figma")
  })

  it("defaults the category and rejects one off the list", () => {
    const result = parseIssueCardInput({ ...good, category: undefined })
    if (result.ok) expect(result.value.category).toBe("general")
    expect(parseIssueCardInput({ ...good, category: "crypto" }).ok).toBe(false)
  })

  it("rejects a body that is not an object", () => {
    expect(parseIssueCardInput(null).ok).toBe(false)
    expect(parseIssueCardInput("nope").ok).toBe(false)
  })
})

describe("parseCardStatus", () => {
  it("accepts only the three known statuses", () => {
    expect(parseCardStatus({ status: "frozen" }).ok).toBe(true)
    expect(parseCardStatus({ status: "deleted" }).ok).toBe(false)
    expect(parseCardStatus({}).ok).toBe(false)
  })
})
