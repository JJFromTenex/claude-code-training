import { isLuhnValid } from "@/lib/cards"
import { describe, expect, it } from "vitest"
import { applyTransition, canTransition, issueCard } from "./cards"
import { store } from "./store"
import { Card, CardStatus } from "./types"

/**
 * The state machine is the rule with teeth: a cancelled card that comes back
 * to life is a card someone deliberately killed still spending money. The
 * matrix below asserts every pair, so a new status cannot be added without
 * someone deciding what it may become.
 */

const STATUSES: CardStatus[] = ["active", "frozen", "cancelled"]

const ALLOWED: Record<CardStatus, CardStatus[]> = {
  active: ["frozen", "cancelled"],
  frozen: ["active", "cancelled"],
  cancelled: [],
}

function card(status: CardStatus): Card {
  return {
    id: "card_0001",
    merchantId: "mch_01",
    nickname: "Ad spend",
    last4: "4242",
    numberRef: "tok_test",
    limit: 25000,
    spent: 0,
    currency: "USD",
    category: "advertising",
    status,
    createdAt: "2026-08-13T00:00:00.000Z",
    requestId: "req_test",
    statusHistory: [{ status: "active", at: "2026-08-13T00:00:00.000Z" }],
  }
}

describe("canTransition", () => {
  it("allows exactly the pairs the domain rule names", () => {
    for (const from of STATUSES) {
      for (const to of STATUSES) {
        expect(canTransition(from, to)).toBe(ALLOWED[from].includes(to))
      }
    }
  })

  it("treats cancelled as terminal", () => {
    expect(canTransition("cancelled", "active")).toBe(false)
    expect(canTransition("cancelled", "frozen")).toBe(false)
  })

  it("rejects a status changing to itself", () => {
    // A no-op transition would append a meaningless history entry.
    for (const status of STATUSES) {
      expect(canTransition(status, status)).toBe(false)
    }
  })
})

describe("applyTransition", () => {
  it("records the new status and when it happened", () => {
    const frozen = applyTransition(
      card("active"),
      "frozen",
      "2026-08-14T00:00:00.000Z",
    )

    expect(frozen?.status).toBe("frozen")
    expect(frozen?.statusHistory).toEqual([
      { status: "active", at: "2026-08-13T00:00:00.000Z" },
      { status: "frozen", at: "2026-08-14T00:00:00.000Z" },
    ])
  })

  it("returns null and changes nothing on an illegal transition", () => {
    const original = card("cancelled")
    const result = applyTransition(
      original,
      "active",
      "2026-08-14T00:00:00.000Z",
    )

    expect(result).toBeNull()
    expect(original.status).toBe("cancelled")
    expect(original.statusHistory).toHaveLength(1)
  })
})

describe("issueCard", () => {
  it("stores the last four and a reference, never the number", () => {
    store.cards.length = 0
    const { card: issued, fullNumber } = issueCard({
      merchantId: "mch_01",
      nickname: "Ad spend",
      limit: 25000,
      currency: "USD",
      category: "advertising",
      requestId: "req_1",
    })

    expect(fullNumber.startsWith("4242")).toBe(true)
    expect(isLuhnValid(fullNumber)).toBe(true)
    expect(issued.last4).toBe(fullNumber.slice(-4))
    expect(issued.numberRef.startsWith("tok_")).toBe(true)

    // The stored record must not carry the number in any field, under any name.
    expect(JSON.stringify(issued)).not.toContain(fullNumber)
    expect(issued.numberRef).not.toContain(fullNumber.slice(0, 12))
  })

  it("starts active with nothing spent", () => {
    store.cards.length = 0
    const { card: issued } = issueCard({
      merchantId: "mch_01",
      nickname: "Contractor tools",
      limit: 100000,
      currency: "USD",
      category: "contractors",
      requestId: "req_2",
    })

    expect(issued.spent).toBe(0)
    expect(issued.status).toBe("active")
    expect(issued.statusHistory).toEqual([
      { status: "active", at: issued.createdAt },
    ])
  })
})
