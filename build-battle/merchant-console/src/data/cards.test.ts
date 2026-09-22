import { beforeEach, describe, expect, it } from "vitest"
import {
  MAX_NICKNAME_LENGTH,
  MAX_SPEND_LIMIT,
  cardById,
  issueCard,
  listCards,
  parseCardStatus,
  parseIssueCardInput,
  transitionCard,
} from "./cards"
import { merchants } from "./merchants"
import { store } from "./store"

/**
 * Covers the server-side guards: the validator that untrusted input passes
 * through, and the store-level state machine. The pure transition table is
 * tested in src/lib/cards.test.ts; this proves the enforcement around it.
 */

const merchantId = merchants[0].id

const valid = {
  nickname: "Ad spend — Q4",
  merchantId,
  spendLimit: 25_000,
  currency: "USD",
  category: "advertising",
}

describe("parseIssueCardInput", () => {
  it("accepts valid input and normalises the nickname", () => {
    const result = parseIssueCardInput({ ...valid, nickname: "  Trimmed  " })
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.value.nickname).toBe("Trimmed")
      expect(result.value.spendLimit).toBe(25_000)
      expect(result.value.currency).toBe("USD")
    }
  })

  it("defaults an absent category to no lock", () => {
    const { category: _omitted, ...withoutCategory } = valid
    const result = parseIssueCardInput(withoutCategory)
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.value.category).toBe("any")
  })

  it.each([
    ["a non-object body", "not an object"],
    ["null", null],
    ["a missing nickname", { ...valid, nickname: "   " }],
    ["an over-long nickname", { ...valid, nickname: "x".repeat(MAX_NICKNAME_LENGTH + 1) }],
    ["a missing merchant", { ...valid, merchantId: "" }],
    ["an unknown merchant", { ...valid, merchantId: "mch_does_not_exist" }],
    ["a zero limit", { ...valid, spendLimit: 0 }],
    ["a negative limit", { ...valid, spendLimit: -1 }],
    ["a limit above the maximum", { ...valid, spendLimit: MAX_SPEND_LIMIT + 1 }],
    ["a non-integer limit", { ...valid, spendLimit: 250.5 }],
    ["a limit sent as a string", { ...valid, spendLimit: "25000" }],
    ["an unsupported currency", { ...valid, currency: "JPY" }],
    ["a lowercase currency", { ...valid, currency: "usd" }],
    ["an unknown category", { ...valid, category: "gambling" }],
  ])("rejects %s", (_label, input) => {
    const result = parseIssueCardInput(input)
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.length).toBeGreaterThan(0)
  })

  it("accepts the maximum limit exactly", () => {
    const result = parseIssueCardInput({ ...valid, spendLimit: MAX_SPEND_LIMIT })
    expect(result.ok).toBe(true)
  })

  it("ignores client-supplied fields that the server owns", () => {
    const result = parseIssueCardInput({
      ...valid,
      status: "cancelled",
      spend: 999_999,
      id: "card_hacked",
      last4: "0000",
    })
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.value).not.toHaveProperty("status")
      expect(result.value).not.toHaveProperty("spend")
      expect(result.value).not.toHaveProperty("id")
      expect(result.value).not.toHaveProperty("last4")
    }
  })
})

describe("parseCardStatus", () => {
  it.each(["active", "frozen", "cancelled"])("accepts %s", (status) => {
    expect(parseCardStatus(status).ok).toBe(true)
  })

  it.each([["melted"], [null], [42], [undefined]])(
    "rejects %s",
    (status) => {
      expect(parseCardStatus(status).ok).toBe(false)
    },
  )
})

describe("issueCard", () => {
  it("stores only the last four, never the number", () => {
    const { card, number } = issueCard({ ...valid, currency: "USD" } as never)
    expect(card).not.toHaveProperty("number")
    expect(card.last4).toBe(number.slice(-4))
    expect(JSON.stringify(card)).not.toContain(number)
  })

  it("starts active with no spend, and appears in the list", () => {
    const { card } = issueCard({ ...valid, currency: "USD" } as never)
    expect(card.status).toBe("active")
    expect(card.spend).toBe(0)
    expect(listCards().some((c) => c.id === card.id)).toBe(true)
    expect(cardById(card.id)?.id).toBe(card.id)
  })

  it("gives each card a reference unrelated to its number", () => {
    const { card, number } = issueCard({ ...valid, currency: "USD" } as never)
    expect(card.reference).not.toContain(number)
    expect(card.reference).not.toContain(card.last4)
  })
})

describe("transitionCard", () => {
  let id: string

  beforeEach(() => {
    id = issueCard({ ...valid, currency: "USD" } as never).card.id
  })

  it("moves active to frozen and back", () => {
    expect(transitionCard(id, "frozen").ok).toBe(true)
    expect(cardById(id)?.status).toBe("frozen")
    expect(transitionCard(id, "active").ok).toBe(true)
    expect(cardById(id)?.status).toBe("active")
  })

  it("cancels from active and from frozen", () => {
    expect(transitionCard(id, "cancelled").ok).toBe(true)
    const second = issueCard({ ...valid, currency: "USD" } as never).card.id
    transitionCard(second, "frozen")
    expect(transitionCard(second, "cancelled").ok).toBe(true)
  })

  it("treats cancelled as terminal and leaves the status untouched", () => {
    transitionCard(id, "cancelled")
    for (const to of ["active", "frozen", "cancelled"] as const) {
      const result = transitionCard(id, to)
      expect(result.ok).toBe(false)
      if (!result.ok) expect(result.error).toMatch(/cancelled/i)
      expect(cardById(id)?.status).toBe("cancelled")
    }
  })

  it("rejects a transition to the status it already holds", () => {
    expect(transitionCard(id, "active").ok).toBe(false)
  })

  it("reports a missing card rather than throwing", () => {
    const result = transitionCard("card_does_not_exist", "frozen")
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error).toBe("Card not found.")
  })

  it("never lets an illegal transition mutate the store", () => {
    const before = store.cards.map((c) => c.status).join(",")
    transitionCard(id, "active")
    transitionCard("card_nope", "cancelled")
    expect(store.cards.map((c) => c.status).join(",")).toBe(before)
  })
})
