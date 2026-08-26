import { MAX_SPEND_LIMIT, isValidLuhn } from "@/lib/cards"
import { describe, expect, it } from "vitest"
import {
  CardIssueInput,
  cardById,
  issueCard,
  parseCardInput,
  spendPercent,
} from "./cards"
import { GENERATED_AT } from "./generate"
import { store } from "./store"

/**
 * The rejection matrix runs against the route handler in
 * app/api/cards/route.test.ts. What is here is what only the unit can say.
 * mch_01 settles in USD, mch_04 in GBP, mch_05 in EUR.
 */

const VALID: CardIssueInput = {
  nickname: "Meta Ads",
  merchantId: "mch_01",
  spendLimit: 25000,
  currency: "USD",
  category: "advertising",
}

const issued = (patch: Partial<CardIssueInput> = {}) => {
  const result = issueCard({ ...VALID, ...patch })
  if (!result.ok) throw new Error(result.message)
  return result.value
}

describe("parseCardInput", () => {
  it.each([
    ["a fractional limit", { spendLimit: 250.5 }],
    ["a limit dressed as currency", { spendLimit: "$250.00" }],
    ["sub-minor precision", { spendLimit: "250.005" }],
    ["a lowercase currency", { currency: "usd" }],
    ["a whitespace-only nickname", { nickname: "   " }],
    ["a category outside the allowlist", { category: "gambling" }],
  ])("rejects %s", (_l, patch) =>
    expect(parseCardInput({ ...VALID, ...patch }).ok).toBe(false),
  )

  it.each([
    ["the ceiling itself", { spendLimit: MAX_SPEND_LIMIT }],
    ["no category", { category: null }],
    ["GBP on a GBP merchant", { merchantId: "mch_04", currency: "GBP" }],
    ["EUR on a EUR merchant", { merchantId: "mch_05", currency: "EUR" }],
  ])("accepts %s", (_l, patch) =>
    expect(parseCardInput({ ...VALID, ...patch }).ok).toBe(true),
  )

  it("converts a typed amount to minor units exactly once", () => {
    const at = (v: unknown) => parseCardInput({ ...VALID, spendLimit: v })
    expect(at("250.00")).toMatchObject({ value: { spendLimit: 25000 } })
    expect(at("1,250")).toMatchObject({ value: { spendLimit: 125000 } })
  })

  it("states the ceiling in money, and refuses a non-object body", () => {
    const over = parseCardInput({ ...VALID, spendLimit: MAX_SPEND_LIMIT + 1 })
    expect(over.ok === false && over.message).toContain("$50,000.00")
    expect(parseCardInput(null).ok).toBe(false)
    expect(parseCardInput("nickname=Meta").ok).toBe(false)
  })
})

describe("issueCard", () => {
  it("keeps the last four, never the full number, and starts unspent", () => {
    const { card, cardNumber } = issued()
    expect(isValidLuhn(cardNumber!)).toBe(true)
    expect(cardNumber!.startsWith("4242")).toBe(true)
    expect(card.last4).toBe(cardNumber!.slice(-4))
    // The record has no field the number could live in.
    expect(JSON.stringify(card)).not.toContain(cardNumber!)

    expect(card.status).toBe("active")
    expect(card.spend).toBe(0)
    expect(cardById(card.id)).toBe(card)
  })

  it("reports spend against the limit as whole percent, clamped", () => {
    const card = issued({ nickname: "Percent", spendLimit: 25000 }).card
    expect(spendPercent(card)).toBe(0)
    card.spend = 20000
    expect(spendPercent(card)).toBe(80)
    card.spend = 40000
    expect(spendPercent(card)).toBe(100)
  })
})

describe("seeded cards", () => {
  // Seeded cards anchor to GENERATED_AT; runtime ones carry a later instant.
  const seeded = store.cards.filter(
    (c) => c.createdAt <= GENERATED_AT.toISOString(),
  )

  it("spend a real sum of their merchant's captured payments", () => {
    expect(seeded.length).toBeGreaterThan(0)
    for (const card of seeded) {
      const available = store.payments
        .filter(
          (p) =>
            p.merchantId === card.merchantId &&
            p.status === "captured" &&
            p.createdAt >= card.createdAt,
        )
        .reduce((sum, p) => sum + p.amount, 0)

      expect(Number.isSafeInteger(card.spend)).toBe(true)
      expect(card.spend).toBeLessThanOrEqual(available)
      expect(card.spend).toBeLessThanOrEqual(card.spendLimit)
      expect(card.currency).toBe(
        store.merchants.find((m) => m.id === card.merchantId)?.currency,
      )
    }
  })
})
