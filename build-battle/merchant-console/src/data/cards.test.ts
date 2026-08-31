import { describe, expect, it } from "vitest"
import {
  CARD_CATEGORIES,
  MAX_CARD_LIMIT,
  NewCardInput,
  canTransition,
  issueCard,
  parseCardInput,
  transitionCard,
} from "./cards"

/**
 * The form is a convenience; this gate is the enforcement. Each case here is
 * one a crafted request could otherwise get past -- a limit above the cap, a
 * currency outside the allowlist, a cancelled card brought back to life.
 *
 * mch_01 is Lumen Coffee Roasters, which exists. mch_99 does not.
 */

const valid = {
  nickname: "Ad spend",
  merchantId: "mch_01",
  limit: "250.00",
  currency: "USD",
  category: "advertising",
}

function inputOf(overrides: Record<string, unknown> = {}) {
  return parseCardInput({ ...valid, ...overrides })
}

function expectRejection(result: ReturnType<typeof parseCardInput>) {
  if (!("error" in result)) throw new Error("expected a rejection")
  return result.error
}

describe("parseCardInput", () => {
  it("converts a typed amount to minor units exactly once", () => {
    const result = inputOf({ limit: "2,500.00" })
    if ("error" in result) throw new Error(result.error.message)
    expect(result.input.limit).toBe(250000)
    expect(Number.isInteger(result.input.limit)).toBe(true)
  })

  it("rejects a missing merchant", () => {
    const error = expectRejection(inputOf({ merchantId: undefined }))
    expect(error.status).toBe(400)
    expect(error.message).toBe("Choose a merchant.")
  })

  it("rejects a merchant that does not exist", () => {
    const error = expectRejection(inputOf({ merchantId: "mch_99" }))
    expect(error.status).toBe(400)
    expect(error.message).toBe("That merchant does not exist.")
  })

  it("rejects a zero limit", () => {
    const error = expectRejection(inputOf({ limit: "0" }))
    expect(error.status).toBe(400)
    expect(error.message).toBe("Spend limit must be more than zero.")
  })

  it("rejects a negative limit", () => {
    expect(expectRejection(inputOf({ limit: "-5" })).status).toBe(400)
  })

  it("rejects a limit above five million minor units", () => {
    const error = expectRejection(inputOf({ limit: "50000.01" }))
    expect(error.status).toBe(400)
    expect(error.message).toContain("cannot exceed")
  })

  it("accepts a limit of exactly five million minor units", () => {
    const result = inputOf({ limit: "50000.00" })
    if ("error" in result) throw new Error(result.error.message)
    expect(result.input.limit).toBe(MAX_CARD_LIMIT)
  })

  it("rejects a currency outside USD, EUR and GBP", () => {
    const error = expectRejection(inputOf({ currency: "JPY" }))
    expect(error.status).toBe(400)
    expect(error.message).toBe("Currency must be USD, EUR, or GBP.")
  })

  it("rejects a limit sent as a number rather than typed text", () => {
    // A client that multiplied by 100 itself must not be trusted.
    expect(expectRejection(inputOf({ limit: 25000 })).status).toBe(400)
  })

  it("rejects a blank nickname", () => {
    expect(expectRejection(inputOf({ nickname: "   " })).status).toBe(400)
  })

  it("rejects a category outside the allowlist", () => {
    expect(expectRejection(inputOf({ category: "weaponry" })).status).toBe(400)
  })

  it("rejects a body that is not an object", () => {
    expect(expectRejection(parseCardInput("nope")).message).toBe(
      "Send a JSON body.",
    )
  })
})

describe("canTransition", () => {
  it("freezes and unfreezes an active card", () => {
    expect(canTransition("active", "frozen")).toBe(true)
    expect(canTransition("frozen", "active")).toBe(true)
  })

  it("cancels from either active or frozen", () => {
    expect(canTransition("active", "cancelled")).toBe(true)
    expect(canTransition("frozen", "cancelled")).toBe(true)
  })

  it("never leaves cancelled", () => {
    expect(canTransition("cancelled", "active")).toBe(false)
    expect(canTransition("cancelled", "frozen")).toBe(false)
    expect(canTransition("cancelled", "cancelled")).toBe(false)
  })

  it("rejects a transition to the status already held", () => {
    expect(canTransition("active", "active")).toBe(false)
  })
})

describe("issueCard", () => {
  const input: NewCardInput = {
    nickname: "Contractor tools",
    merchantId: "mch_01",
    limit: 25000,
    currency: "USD",
    category: "software",
  }

  it("keeps the full number off the stored record", () => {
    const { card, number } = issueCard(input)
    expect(number).toHaveLength(16)
    expect(card).not.toHaveProperty("number")
    expect(JSON.stringify(card)).not.toContain(number)
    expect(card.last4).toBe(number.slice(-4))
  })

  it("starts a card active, unspent, and with an issue entry logged", () => {
    const { card } = issueCard(input)
    expect(card.status).toBe("active")
    expect(card.spent).toBe(0)
    expect(card.history).toHaveLength(1)
    expect(card.history[0]).toMatchObject({ from: null, to: "active" })
  })
})

describe("transitionCard", () => {
  const input: NewCardInput = {
    nickname: "Travel",
    merchantId: "mch_01",
    limit: 25000,
    currency: "USD",
    category: "travel",
  }

  it("records every transition it allows", () => {
    const { card } = issueCard(input)
    transitionCard(card.id, "frozen")
    const result = transitionCard(card.id, "active")
    if ("error" in result) throw new Error(result.error.message)
    expect(result.card.status).toBe("active")
    expect(result.card.history.map((entry) => entry.to)).toEqual([
      "active",
      "frozen",
      "active",
    ])
  })

  it("refuses to bring a cancelled card back", () => {
    const { card } = issueCard(input)
    transitionCard(card.id, "cancelled")
    const result = transitionCard(card.id, "active")
    if (!("error" in result)) throw new Error("expected a rejection")
    expect(result.error.status).toBe(409)
    expect(result.error.message).toBe("A cancelled card cannot be changed.")
  })

  it("rejects a status that is not a card status", () => {
    const { card } = issueCard(input)
    const result = transitionCard(card.id, "melted")
    if (!("error" in result)) throw new Error("expected a rejection")
    expect(result.error.status).toBe(400)
  })

  it("reports an unknown card as missing, not as a bad transition", () => {
    const result = transitionCard("vcard_9999", "frozen")
    if (!("error" in result)) throw new Error("expected a rejection")
    expect(result.error.status).toBe(404)
  })

  it("leaves a cancelled card cancelled", () => {
    const { card } = issueCard(input)
    transitionCard(card.id, "cancelled")
    expect(card.status).toBe("cancelled")
  })
})

describe("CARD_CATEGORIES", () => {
  it("is the allowlist the gate checks against", () => {
    expect(CARD_CATEGORIES).toContain("advertising")
    expect(CARD_CATEGORIES).not.toContain("weaponry")
  })
})
