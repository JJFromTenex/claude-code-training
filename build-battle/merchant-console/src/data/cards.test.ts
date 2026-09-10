import { beforeEach, describe, expect, it } from "vitest"
import { cardByIssueKey, insertCard, transitionCard } from "./cards"
import { store } from "./store"

/**
 * Store-level behaviour that the route handlers rely on: a retried issue
 * request must not mint a second card, and every status change must be kept.
 * Numbers here are last-four only; the store never sees a full number.
 */

const fields = {
  nickname: "Ad spend",
  merchantId: "mch_01",
  spendLimit: 25000,
  currency: "USD" as const,
  last4: "4242",
  numberRef: "cnum_test",
}

beforeEach(() => {
  store.cards.length = 0
  for (const key of Object.keys(store.cardIssueKeys)) delete store.cardIssueKeys[key]
})

describe("insertCard", () => {
  it("starts active with no spend and an issuance entry in the history", () => {
    const at = new Date("2026-09-10T12:00:00.000Z")
    const card = insertCard(fields, { now: at })
    expect(card).toMatchObject({
      status: "active",
      spent: 0,
      createdAt: at.toISOString(),
      history: [{ status: "active", at: at.toISOString() }],
    })
    expect("number" in card).toBe(false)
  })

  it("remembers the idempotency key so a retry finds the same card", () => {
    const first = insertCard(fields, { idempotencyKey: "req_1" })
    expect(cardByIssueKey("req_1")).toBe(first)
    expect(cardByIssueKey("req_2")).toBeNull()
    expect(store.cards).toHaveLength(1)
  })
})

describe("transitionCard", () => {
  it("appends each legal change to the history with its time", () => {
    const card = insertCard(fields, { now: new Date("2026-09-10T12:00:00.000Z") })
    const frozenAt = new Date("2026-09-11T09:00:00.000Z")
    const result = transitionCard(card.id, "frozen", frozenAt)
    expect(result.ok).toBe(true)
    expect(card.status).toBe("frozen")
    expect(card.updatedAt).toBe(frozenAt.toISOString())
    expect(card.history.map((h) => h.status)).toEqual(["active", "frozen"])
  })

  it("refuses to leave cancelled and records nothing", () => {
    const card = insertCard(fields)
    transitionCard(card.id, "cancelled")
    const result = transitionCard(card.id, "active")
    expect(result).toMatchObject({ ok: false, reason: "illegal_transition" })
    expect(card.status).toBe("cancelled")
    expect(card.history).toHaveLength(2)
  })

  it("reports an unknown card", () => {
    expect(transitionCard("card_999999", "frozen")).toMatchObject({
      ok: false,
      reason: "not_found",
    })
  })
})
