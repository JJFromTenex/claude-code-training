import { describe, expect, it } from "vitest"
import {
  canTransition,
  issueCard,
  transitionCard,
  validateIssueRequest,
} from "./cards"
import { Card, CardStatus } from "./types"

/**
 * The two things a card gets wrong in ways nobody notices until it matters:
 * a limit that should have been refused, and a status that should not have
 * moved. Both are guarded on the server, so both are tested here.
 */

const valid = {
  nickname: "Vendor subscriptions",
  merchantId: "mch_01",
  spendLimit: 25000,
  currency: "USD",
  category: "software",
}

function cardWith(status: CardStatus): Card {
  return {
    id: "card_000001",
    nickname: "Test card",
    merchantId: "mch_01",
    spendLimit: 25000,
    spend: 0,
    currency: "USD",
    status,
    last4: "4242",
    reference: "cn_0000000001",
    category: null,
    createdAt: "2026-08-01T00:00:00.000Z",
    history: [
      {
        status: "active",
        at: "2026-08-01T00:00:00.000Z",
        note: "Card issued and live",
      },
    ],
  }
}

describe("validateIssueRequest", () => {
  it("accepts a well formed request", () => {
    const result = validateIssueRequest(valid)
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.value.spendLimit).toBe(25000)
      expect(result.value.currency).toBe("USD")
      expect(result.value.category).toBe("software")
    }
  })

  it("rejects a missing merchant", () => {
    expect(validateIssueRequest({ ...valid, merchantId: undefined }).ok).toBe(
      false,
    )
    expect(validateIssueRequest({ ...valid, merchantId: "" }).ok).toBe(false)
  })

  it("rejects a merchant that does not exist", () => {
    expect(validateIssueRequest({ ...valid, merchantId: "mch_99" }).ok).toBe(
      false,
    )
  })

  it("rejects a zero or negative limit", () => {
    expect(validateIssueRequest({ ...valid, spendLimit: 0 }).ok).toBe(false)
    expect(validateIssueRequest({ ...valid, spendLimit: -1 }).ok).toBe(false)
  })

  it("rejects a limit above five million minor units", () => {
    expect(validateIssueRequest({ ...valid, spendLimit: 5_000_001 }).ok).toBe(
      false,
    )
    // The ceiling itself is allowed.
    expect(validateIssueRequest({ ...valid, spendLimit: 5_000_000 }).ok).toBe(
      true,
    )
  })

  it("rejects a limit that is not integer minor units", () => {
    // Money never arrives as a float or a formatted string.
    expect(validateIssueRequest({ ...valid, spendLimit: 250.5 }).ok).toBe(false)
    expect(validateIssueRequest({ ...valid, spendLimit: "25000" }).ok).toBe(
      false,
    )
    expect(validateIssueRequest({ ...valid, spendLimit: "$250.00" }).ok).toBe(
      false,
    )
  })

  it("rejects a currency outside the allowlist", () => {
    expect(validateIssueRequest({ ...valid, currency: "JPY" }).ok).toBe(false)
  })

  it("rejects a currency the merchant does not settle in", () => {
    // mch_01 is USD; mch_04 is GBP. A card has to match its merchant, or the
    // limit cannot be compared to the spend it is meant to cap.
    expect(validateIssueRequest({ ...valid, currency: "EUR" }).ok).toBe(false)
    expect(
      validateIssueRequest({ ...valid, merchantId: "mch_04", currency: "GBP" })
        .ok,
    ).toBe(true)
    expect(
      validateIssueRequest({ ...valid, merchantId: "mch_04", currency: "USD" })
        .ok,
    ).toBe(false)
  })

  it("rejects a missing or blank nickname", () => {
    expect(validateIssueRequest({ ...valid, nickname: "" }).ok).toBe(false)
    expect(validateIssueRequest({ ...valid, nickname: "   " }).ok).toBe(false)
  })

  it("rejects a category outside the allowlist but allows none", () => {
    expect(validateIssueRequest({ ...valid, category: "crypto" }).ok).toBe(false)

    const none = validateIssueRequest({ ...valid, category: null })
    expect(none.ok).toBe(true)
    if (none.ok) expect(none.value.category).toBeNull()
  })

  it("rejects something that is not an object at all", () => {
    expect(validateIssueRequest(null).ok).toBe(false)
    expect(validateIssueRequest("card").ok).toBe(false)
  })

  it("returns a message safe to show a user", () => {
    const result = validateIssueRequest({ ...valid, spendLimit: 0 })
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.message).toBe("The spend limit must be more than zero.")
    }
  })
})

describe("canTransition", () => {
  it("allows active and frozen to swap either way", () => {
    expect(canTransition("active", "frozen")).toBe(true)
    expect(canTransition("frozen", "active")).toBe(true)
  })

  it("allows either to be cancelled", () => {
    expect(canTransition("active", "cancelled")).toBe(true)
    expect(canTransition("frozen", "cancelled")).toBe(true)
  })

  it("lets nothing come back from cancelled", () => {
    expect(canTransition("cancelled", "active")).toBe(false)
    expect(canTransition("cancelled", "frozen")).toBe(false)
    expect(canTransition("cancelled", "cancelled")).toBe(false)
  })
})

describe("transitionCard", () => {
  it("moves a card and reports the new status", () => {
    const card = cardWith("active")
    const result = transitionCard(card, "frozen")
    expect(result.ok).toBe(true)
    expect(card.status).toBe("frozen")
  })

  it("refuses to move a cancelled card and leaves it alone", () => {
    const card = cardWith("cancelled")
    const result = transitionCard(card, "active")
    expect(result.ok).toBe(false)
    expect(card.status).toBe("cancelled")
  })

  it("refuses a move to the status it is already in", () => {
    const card = cardWith("frozen")
    expect(transitionCard(card, "frozen").ok).toBe(false)
  })

  it("records every move in the history, oldest first", () => {
    const card = cardWith("active")
    transitionCard(card, "frozen")
    transitionCard(card, "active")
    transitionCard(card, "cancelled")

    expect(card.history.map((e) => e.status)).toEqual([
      "active",
      "frozen",
      "active",
      "cancelled",
    ])
    // Ops needs to read this, not decode it.
    expect(card.history.at(-1)?.note).toBe(
      "Cancelled from active. This is permanent",
    )
  })

  it("records nothing when a move is refused", () => {
    const card = cardWith("cancelled")
    const before = card.history.length
    transitionCard(card, "active")
    expect(card.history.length).toBe(before)
  })
})

describe("issueCard", () => {
  it("issues one card per idempotency key", () => {
    const request = validateIssueRequest(valid)
    expect(request.ok).toBe(true)
    if (!request.ok) return

    const first = issueCard(request.value, "key-abc")
    const second = issueCard(request.value, "key-abc")

    expect(second.card.id).toBe(first.card.id)
    expect(second.replayed).toBe(true)
    // The number was revealed once. A replay does not reveal it again.
    expect(second.cardNumber).toBe("")
  })

  it("issues separate cards for separate keys", () => {
    const request = validateIssueRequest(valid)
    if (!request.ok) return

    const a = issueCard(request.value, "key-1")
    const b = issueCard(request.value, "key-2")
    expect(a.card.id).not.toBe(b.card.id)
  })

  it("starts a new card active, at zero spend, with a history entry", () => {
    const request = validateIssueRequest(valid)
    if (!request.ok) return

    const { card, cardNumber } = issueCard(request.value)
    expect(card.status).toBe("active")
    expect(card.spend).toBe(0)
    expect(card.last4).toBe(cardNumber.slice(-4))
    expect(card.history).toHaveLength(1)
    // Nothing on the record can hold the full number.
    expect(JSON.stringify(card)).not.toContain(cardNumber)
  })
})
