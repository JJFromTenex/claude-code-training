import { describe, expect, it } from "vitest"
import { MAX_SPEND_LIMIT } from "@/lib/cards"
import { issueCard, parseIssueCardInput, transitionCard } from "./cards"

const valid = { merchantId: "mch_01", nickname: "Meta ads", category: "advertising", spendLimit: 25000, currency: "USD" as const }
const bad = (over: Record<string, unknown>) => parseIssueCardInput({ ...valid, ...over }).ok

describe("parseIssueCardInput", () => {
  it("accepts a well-formed body", () => {
    const r = parseIssueCardInput(valid)
    expect(r.ok && r.value.spendLimit).toBe(25000)
  })
  it("rejects a missing or unknown merchant", () => {
    expect(bad({ merchantId: "" })).toBe(false)
    expect(bad({ merchantId: undefined })).toBe(false)
    expect(bad({ merchantId: "mch_99" })).toBe(false)
  })
  it("rejects a zero, negative, or over-limit amount", () => {
    expect(bad({ spendLimit: 0 })).toBe(false)
    expect(bad({ spendLimit: -100 })).toBe(false)
    expect(bad({ spendLimit: MAX_SPEND_LIMIT })).toBe(true)
    expect(bad({ spendLimit: MAX_SPEND_LIMIT + 1 })).toBe(false)
  })
  it("rejects a non-integer limit — money is integer minor units", () => {
    expect(bad({ spendLimit: 250.5 })).toBe(false)
    expect(bad({ spendLimit: "25000" })).toBe(false)
    expect(bad({ spendLimit: "$250.00" })).toBe(false)
  })
  it("rejects any currency outside USD, EUR, GBP", () => {
    expect(bad({ currency: "CAD" })).toBe(false)
    expect(bad({ currency: "usd" })).toBe(false)
  })
  it("rejects a currency that is not the merchant's own", () => {
    expect(bad({ currency: "EUR" })).toBe(false) // mch_01 settles in USD
    expect(bad({ merchantId: "mch_05", currency: "EUR" })).toBe(true)
  })
  it("rejects an unknown category and defaults a missing one to any", () => {
    expect(bad({ category: "gambling" })).toBe(false)
    const r = parseIssueCardInput({ ...valid, category: undefined })
    expect(r.ok && r.value.category).toBe("any")
  })
  it("rejects a non-object body", () => {
    expect(parseIssueCardInput(null).ok).toBe(false)
  })
})

describe("issueCard", () => {
  it("returns the number once and never stores it", () => {
    const r = issueCard({ ...valid, category: "any" })
    expect(r.replayed).toBe(false)
    if (r.replayed) return
    expect(r.number.startsWith("4242")).toBe(true)
    expect(r.card.last4).toBe(r.number.slice(-4))
    expect(JSON.stringify(r.card)).not.toContain(r.number)
    expect(r.card.history).toEqual([{ status: "active", at: r.card.createdAt }])
  })
  it("replays the same card for the same idempotency key, without the number", () => {
    const first = issueCard({ ...valid, category: "any", idempotencyKey: "retry-0001" })
    const again = issueCard({ ...valid, category: "any", idempotencyKey: "retry-0001" })
    expect(again.replayed).toBe(true)
    expect(again.card.id).toBe(first.card.id)
    expect("number" in again).toBe(false)
  })
})

describe("transitionCard", () => {
  it("records every status change in the card's history", () => {
    const { card } = issueCard({ ...valid, category: "any" })
    expect(transitionCard(card.id, "frozen").ok).toBe(true)
    expect(transitionCard(card.id, "cancelled").ok).toBe(true)
    expect(card.history.map((h) => h.status)).toEqual(["active", "frozen", "cancelled"])
    const dead = transitionCard(card.id, "active")
    expect(dead.ok).toBe(false)
    if (!dead.ok) expect(dead.status).toBe(409)
  })
})
