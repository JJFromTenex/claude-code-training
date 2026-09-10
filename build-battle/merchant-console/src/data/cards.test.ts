import { beforeEach, describe, expect, it } from "vitest"
import { isLuhnValid, TEST_BIN } from "@/lib/cards"
import { cardById, issueCard, listCards, transitionCard } from "./cards"
import { store } from "./store"
import { Card, IssueCardInput } from "./types"

/**
 * The store is a module-level singleton. Each test starts from the seed set
 * so the order tests run in cannot change what they see.
 */

const seed: Card[] = store.cards.map((card) => ({
  ...card,
  events: [...card.events],
}))

beforeEach(() => {
  store.cards.splice(0, store.cards.length, ...seed.map((card) => ({
    ...card,
    events: [...card.events],
  })))
})

const input: IssueCardInput = {
  nickname: "Ad spend",
  merchantId: "mch_01",
  spendLimit: 25000,
  currency: "USD",
  categoryLock: "advertising",
}

describe("seed cards", () => {
  it("carry the last four and a reference, never a number", () => {
    expect(store.cards.length).toBeGreaterThan(0)
    for (const card of store.cards) {
      expect(card.last4).toMatch(/^\d{4}$/)
      expect(card.numberRef).toMatch(/^cn_/)
      expect(card).not.toHaveProperty("number")
      expect(Number.isInteger(card.spendLimit)).toBe(true)
      expect(Number.isInteger(card.spent)).toBe(true)
    }
  })

  it("did not change the payment seed everyone already has", () => {
    // Fingerprint taken before cards were added to generate().
    const payments = store.payments
    expect(payments).toHaveLength(1658)
    expect(payments.reduce((sum, p) => sum + p.amount, 0)).toBe(40754949)
    expect(payments[0]).toMatchObject({ id: "pay_000001", amount: 2978 })
    expect(payments[payments.length - 1]).toMatchObject({
      id: "pay_001658",
      amount: 19291,
    })
  })
})

describe("issueCard", () => {
  it("returns the full number once, beside a record that never holds it", () => {
    const before = store.cards.length
    const { card, number } = issueCard(input, new Date("2026-08-14T09:00:00Z"))

    expect(number).toMatch(/^\d{16}$/)
    expect(number.startsWith(TEST_BIN)).toBe(true)
    expect(isLuhnValid(number)).toBe(true)

    expect(card).not.toHaveProperty("number")
    expect(card.last4).toBe(number.slice(-4))
    expect(card.numberRef).toMatch(/^cn_[0-9a-f]{16}$/)
    expect(JSON.stringify(store.cards)).not.toContain(number)
    expect(store.cards).toHaveLength(before + 1)
  })

  it("stores the validated input as given, in minor units, and starts active", () => {
    const { card } = issueCard(input, new Date("2026-08-14T09:00:00Z"))
    expect(card).toMatchObject({
      nickname: "Ad spend",
      merchantId: "mch_01",
      spendLimit: 25000,
      spent: 0,
      currency: "USD",
      status: "active",
      categoryLock: "advertising",
      createdAt: "2026-08-14T09:00:00.000Z",
    })
    expect(card.events).toEqual([
      { type: "issued", at: "2026-08-14T09:00:00.000Z" },
    ])
    expect(cardById(card.id)).toBe(card)
  })

  it("gives every card a distinct id and reference", () => {
    const a = issueCard(input).card
    const b = issueCard(input).card
    expect(a.id).not.toBe(b.id)
    expect(a.numberRef).not.toBe(b.numberRef)
  })
})

describe("listCards", () => {
  it("returns newest first without mutating the store order", () => {
    const original = store.cards.map((c) => c.id)
    const listed = listCards()
    for (let i = 1; i < listed.length; i++) {
      expect(listed[i - 1].createdAt >= listed[i].createdAt).toBe(true)
    }
    expect(store.cards.map((c) => c.id)).toEqual(original)
  })

  it("includes a card issued just now at the top", () => {
    const { card } = issueCard(input, new Date("2030-01-01T00:00:00Z"))
    expect(listCards()[0].id).toBe(card.id)
  })
})

describe("transitionCard", () => {
  it("freezes and unfreezes an active card, writing an event each time", () => {
    const { card } = issueCard(input)
    const frozen = transitionCard(card.id, "frozen", new Date("2026-08-15T00:00:00Z"))
    expect(frozen).toMatchObject({ ok: true, card: { status: "frozen" } })

    const active = transitionCard(card.id, "active", new Date("2026-08-16T00:00:00Z"))
    expect(active).toMatchObject({ ok: true, card: { status: "active" } })

    expect(card.events.map((e) => e.type)).toEqual([
      "issued",
      "frozen",
      "unfrozen",
    ])
    expect(card.events[1].at).toBe("2026-08-15T00:00:00.000Z")
  })

  it("cancels from either state and then refuses everything", () => {
    const a = issueCard(input).card
    expect(transitionCard(a.id, "cancelled")).toMatchObject({ ok: true })

    const b = issueCard(input).card
    transitionCard(b.id, "frozen")
    expect(transitionCard(b.id, "cancelled")).toMatchObject({ ok: true })

    for (const card of [a, b]) {
      expect(transitionCard(card.id, "active")).toMatchObject({
        ok: false,
        reason: "invalid_transition",
      })
      expect(transitionCard(card.id, "frozen")).toMatchObject({
        ok: false,
        reason: "invalid_transition",
      })
      expect(card.status).toBe("cancelled")
      expect(card.events.filter((e) => e.type === "cancelled")).toHaveLength(1)
    }
  })

  it("refuses a no-op transition without writing an event", () => {
    const { card } = issueCard(input)
    const result = transitionCard(card.id, "active")
    expect(result).toMatchObject({ ok: false, reason: "invalid_transition" })
    expect(card.events).toHaveLength(1)
  })

  it("reports an unknown card", () => {
    expect(transitionCard("card_999999", "frozen")).toEqual({
      ok: false,
      reason: "not_found",
    })
  })
})
