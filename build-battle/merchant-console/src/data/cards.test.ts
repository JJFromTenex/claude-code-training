import { beforeEach, describe, expect, it } from "vitest"
import { createCard, updateCardStatus } from "./cards"
import { store } from "./store"

const input = {
  nickname: "Test card",
  merchantId: "mch_01",
  limit: 25000,
  currency: "USD" as const,
}

// The store is a module-level singleton (globalThis, by design — see
// store.ts), so each test clears the cards array itself rather than
// re-importing a fresh module.
beforeEach(() => {
  store.cards.length = 0
})

describe("createCard", () => {
  it("creates a distinct card on each call with no idempotency key", () => {
    const first = createCard(input)
    const second = createCard(input)
    expect(first.card.id).not.toBe(second.card.id)
    expect(first.duplicate).toBe(false)
    expect(second.duplicate).toBe(false)
    expect(store.cards).toHaveLength(2)
  })

  it("returns the same card on a retried request, not a second one", () => {
    const first = createCard({ ...input, idempotencyKey: "req-1" })
    const second = createCard({ ...input, idempotencyKey: "req-1" })

    expect(second.card.id).toBe(first.card.id)
    expect(second.duplicate).toBe(true)
    expect(store.cards).toHaveLength(1)
  })

  it("never re-reveals the number on a retried request", () => {
    const first = createCard({ ...input, idempotencyKey: "req-2" })
    const second = createCard({ ...input, idempotencyKey: "req-2" })

    expect(first.number).not.toBeNull()
    expect(second.number).toBeNull()
  })

  it("treats a different idempotency key as a genuinely new card", () => {
    createCard({ ...input, idempotencyKey: "req-3" })
    const second = createCard({ ...input, idempotencyKey: "req-4" })
    expect(second.duplicate).toBe(false)
    expect(store.cards).toHaveLength(2)
  })

  it("seeds history with a single active entry", () => {
    const { card } = createCard(input)
    expect(card.history).toEqual([{ status: "active", at: card.createdAt }])
  })
})

describe("updateCardStatus", () => {
  it("appends to history on a legal transition", () => {
    const { card } = createCard(input)
    const updated = updateCardStatus(card.id, "frozen")
    expect(updated?.status).toBe("frozen")
    expect(updated?.history.map((h) => h.status)).toEqual(["active", "frozen"])
  })

  it("does not mutate history on an illegal transition", () => {
    const { card } = createCard(input)
    updateCardStatus(card.id, "cancelled")
    const rejected = updateCardStatus(card.id, "active")
    expect(rejected).toBeNull()
    expect(card.history.map((h) => h.status)).toEqual(["active", "cancelled"])
  })
})
