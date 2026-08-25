import { MAX_SPEND_LIMIT, isValidLuhn } from "@/lib/cards"
import { describe, expect, it } from "vitest"
import {
  CardIssueInput,
  cardById,
  issueCard,
  listCards,
  parseCardInput,
  spendPercent,
  transitionCard,
} from "./cards"
import { GENERATED_AT } from "./generate"
import { store } from "./store"

/**
 * The server is the enforcement, so these cases go straight at it rather than
 * through the form. Anything the form happens to prevent must still be
 * rejected here.
 */

/** mch_01 settles in USD, mch_04 in GBP, mch_05 in EUR. */
const VALID: CardIssueInput = {
  nickname: "Meta Ads",
  merchantId: "mch_01",
  spendLimit: 25000,
  currency: "USD",
  category: "advertising",
}

/** issueCard now returns a ParseResult; these helpers unwrap the happy path. */
const issued = (overrides: Partial<CardIssueInput> = {}, key?: string) => {
  const result = issueCard({ ...VALID, ...overrides }, key)
  if (!result.ok) throw new Error(`expected an issued card: ${result.message}`)
  return result.value
}
const make = (overrides: Partial<CardIssueInput> = {}) => issued(overrides).card

describe("parseCardInput", () => {
  it("accepts a well-formed card", () => {
    expect(parseCardInput(VALID)).toEqual({ ok: true, value: { ...VALID } })
  })

  it.each([
    ["missing merchant", { merchantId: "" }],
    ["merchant that does not exist", { merchantId: "mch_99" }],
    ["missing nickname", { nickname: "" }],
    ["whitespace-only nickname", { nickname: "   " }],
    ["zero limit", { spendLimit: 0 }],
    ["negative limit", { spendLimit: -25000 }],
    ["limit above the ceiling", { spendLimit: MAX_SPEND_LIMIT + 1 }],
    ["fractional limit", { spendLimit: 250.5 }],
    ["limit dressed as currency", { spendLimit: "$250.00" }],
    ["limit with sub-minor precision", { spendLimit: "250.005" }],
    ["currency outside the allowlist", { currency: "JPY" }],
    ["lowercase currency", { currency: "usd" }],
    ["numeric currency code", { currency: 840 }],
    ["category outside the allowlist", { category: "gambling" }],
  ])("rejects a %s", (_label, patch) => {
    expect(parseCardInput({ ...VALID, ...patch }).ok).toBe(false)
  })

  it("accepts the ceiling itself, and every allowed currency for its merchant", () => {
    expect(parseCardInput({ ...VALID, spendLimit: MAX_SPEND_LIMIT }).ok).toBe(
      true,
    )
    expect(parseCardInput({ ...VALID, category: null }).ok).toBe(true)
    // mch_04 settles in GBP, mch_05 in EUR.
    expect(
      parseCardInput({ ...VALID, merchantId: "mch_04", currency: "GBP" }).ok,
    ).toBe(true)
    expect(
      parseCardInput({ ...VALID, merchantId: "mch_05", currency: "EUR" }).ok,
    ).toBe(true)
  })

  it("refuses a currency the merchant does not settle in", () => {
    // A GBP limit and a USD spend on one record makes the bar meaningless.
    const result = parseCardInput({ ...VALID, currency: "GBP" })
    expect(result.ok).toBe(false)
    expect(result.ok === false && result.message).toContain("USD")
  })

  it("converts a typed amount to minor units exactly once", () => {
    expect(parseCardInput({ ...VALID, spendLimit: "250.00" })).toMatchObject({
      value: { spendLimit: 25000 },
    })
    expect(parseCardInput({ ...VALID, spendLimit: "1,250" })).toMatchObject({
      value: { spendLimit: 125000 },
    })
  })

  it("rejects a body that is not an object", () => {
    expect(parseCardInput(null).ok).toBe(false)
    expect(parseCardInput("nickname=Meta").ok).toBe(false)
  })
})

describe("issueCard", () => {
  it("stores the last four and a reference, never the full number", () => {
    const { card, cardNumber } = issued()

    expect(cardNumber).not.toBeNull()
    expect(cardNumber!.startsWith("4242")).toBe(true)
    expect(isValidLuhn(cardNumber!)).toBe(true)
    expect(card.last4).toBe(cardNumber!.slice(-4))

    // The record has no field the number could live in.
    expect(JSON.stringify(card)).not.toContain(cardNumber!)
    expect(Object.keys(card)).not.toContain("cardNumber")
  })

  it("starts a card active with nothing spent, and puts it in the list", () => {
    const card = make({ nickname: "Fresh", merchantId: "mch_04", currency: "GBP" })
    expect(card.status).toBe("active")
    expect(card.spend).toBe(0)
    expect(cardById(card.id)).toBe(card)
    expect(listCards().map((c) => c.id)).toContain(card.id)
  })

  it("records the issue in the card's history", () => {
    const card = make({ nickname: "History" })
    expect(card.events).toEqual([
      { from: null, to: "active", at: card.createdAt },
    ])
  })
})

describe("issueCard idempotency", () => {
  it("returns the same card for a repeated key rather than a second one", () => {
    const key = "idem-test-key-1"
    const before = store.cards.length

    const first = issued({ nickname: "Once" }, key)
    const replay = issued({ nickname: "Once" }, key)

    expect(replay.card.id).toBe(first.card.id)
    expect(replay.replayed).toBe(true)
    expect(store.cards.length).toBe(before + 1)
  })

  it("does not re-reveal the number on a replay", () => {
    const key = "idem-test-key-2"
    expect(issued({}, key).cardNumber).not.toBeNull()
    expect(issued({}, key).cardNumber).toBeNull()
  })

  it("treats a different key as a different card", () => {
    expect(issued({}, "idem-a").card.id).not.toBe(issued({}, "idem-b").card.id)
  })

  it("refuses a key already spent on a different card", () => {
    const key = "idem-reused"
    const first = issued({ nickname: "A", spendLimit: 10000 }, key)

    // Same key, genuinely different card. Answering with `first` would tell
    // ops they hold a GBP card for mch_04 when they hold a USD one for mch_01.
    const conflict = issueCard(
      {
        nickname: "TOTALLY DIFFERENT",
        merchantId: "mch_04",
        spendLimit: 500000,
        currency: "GBP",
        category: "travel",
      },
      key,
    )

    expect(conflict.ok).toBe(false)
    expect(cardById(first.card.id)?.nickname).toBe("A")
    expect(store.cards.filter((c) => c.nickname === "TOTALLY DIFFERENT")).toHaveLength(0)
  })
})

describe("transitionCard", () => {
  it("freezes and unfreezes, recording each move", () => {
    const card = make({ nickname: "Toggle" })
    expect(transitionCard(card.id, "frozen").ok).toBe(true)
    expect(transitionCard(card.id, "active").ok).toBe(true)

    expect(cardById(card.id)?.status).toBe("active")
    expect(card.events.map((e) => `${e.from}>${e.to}`)).toEqual([
      "null>active",
      "active>frozen",
      "frozen>active",
    ])
  })

  it("refuses to bring a cancelled card back, and logs nothing when it does", () => {
    const card = make({ nickname: "Terminal" })
    expect(transitionCard(card.id, "cancelled").ok).toBe(true)
    const afterCancel = card.events.length

    expect(transitionCard(card.id, "active").ok).toBe(false)
    expect(transitionCard(card.id, "frozen").ok).toBe(false)
    expect(cardById(card.id)?.status).toBe("cancelled")
    expect(card.events).toHaveLength(afterCancel)
  })

  it("refuses a transition on a card that does not exist", () => {
    expect(transitionCard("card_9999", "frozen").ok).toBe(false)
  })
})

describe("spendPercent", () => {
  it("reports spend against the limit, clamping overspend", () => {
    const card = make({ nickname: "Percent", spendLimit: 25000 })
    expect(spendPercent(card)).toBe(0)
    card.spend = 20000
    expect(spendPercent(card)).toBe(80)
    card.spend = 40000
    expect(spendPercent(card)).toBe(100)
  })
})

describe("seeded cards", () => {
  // Seeded cards are anchored to GENERATED_AT; anything issued at runtime
  // carries a real instant, which is later. `cref_000*` would also have
  // matched the ninth card a test issues.
  const seeded = store.cards.filter(
    (c) => c.createdAt <= GENERATED_AT.toISOString(),
  )

  it("exist, so the assertions below are not vacuous", () => {
    expect(seeded.length).toBeGreaterThan(0)
  })

  it("carry a spend that is a real sum of their merchant's captured payments", () => {
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
      // Spend is a subset of what that merchant actually captured, not invented.
      expect(card.spend).toBeLessThanOrEqual(available)
      expect(card.spend).toBeLessThanOrEqual(card.spendLimit)
    }
  })

  it("settle in their own merchant's currency", () => {
    for (const card of seeded) {
      const merchant = store.merchants.find((m) => m.id === card.merchantId)
      expect(card.currency).toBe(merchant?.currency)
    }
  })
})
