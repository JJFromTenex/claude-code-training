import { describe, expect, it } from "vitest"
import { createCard } from "./cardQueries"

/**
 * `createCard` guards against issuing twice for the same request id — a
 * double-click race or a client retry that never saw the first response.
 */

const baseInput = {
  nickname: "Ad spend Q3",
  merchantId: "mch_01",
  spendLimit: 25000,
  currency: "USD" as const,
  category: null,
}

describe("createCard idempotency", () => {
  it("creates a card for a fresh request id", () => {
    const result = createCard({ ...baseInput, requestId: "req_unique_a" })
    expect(result.ok).toBe(true)
  })

  it("rejects a second create with the same request id", () => {
    const requestId = "req_unique_b"
    const first = createCard({ ...baseInput, requestId })
    const second = createCard({ ...baseInput, requestId })

    expect(first.ok).toBe(true)
    expect(second).toEqual({
      ok: false,
      status: 409,
      error: "This request has already been processed.",
    })
  })

  it("allows two different request ids to each create a card", () => {
    const first = createCard({ ...baseInput, requestId: "req_unique_c" })
    const second = createCard({ ...baseInput, requestId: "req_unique_d" })

    expect(first.ok).toBe(true)
    expect(second.ok).toBe(true)
  })
})
