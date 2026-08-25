import { describe, expect, it } from "vitest"
import { isValidLuhn } from "@/lib/cards"
import { CURRENCIES, MAX_SPEND_LIMIT, spendRatio } from "./card-catalog"
import {
  cardById,
  cardSpend,
  eventsForCard,
  issueCard,
  issuedForKey,
  listCards,
  rememberIdempotencyKey,
  setCardStatus,
  validateIssueInput,
} from "./cards"
import { store } from "./store"

/**
 * The client is not trusted, so each rejection the ticket names gets a case
 * here rather than relying on the form to prevent it.
 */

const valid = {
  nickname: "Vendor subscriptions",
  merchantId: "mch_01", // Lumen Coffee Roasters, USD
  spendLimit: 25_000,
  currency: "USD",
  categoryLock: "software",
}

function errorFields(raw: unknown): string[] {
  const result = validateIssueInput(raw)
  return result.ok ? [] : result.errors.map((error) => error.field)
}

describe("validateIssueInput", () => {
  it("accepts a well-formed card", () => {
    const result = validateIssueInput(valid)
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.input.spendLimit).toBe(25_000)
      expect(result.input.currency).toBe("USD")
    }
  })

  it("rejects a missing or unknown merchant", () => {
    expect(errorFields({ ...valid, merchantId: undefined })).toContain("merchantId")
    expect(errorFields({ ...valid, merchantId: "" })).toContain("merchantId")
    expect(errorFields({ ...valid, merchantId: "mch_99" })).toContain("merchantId")
  })

  it("rejects a zero or negative limit", () => {
    expect(errorFields({ ...valid, spendLimit: 0 })).toContain("spendLimit")
    expect(errorFields({ ...valid, spendLimit: -1 })).toContain("spendLimit")
    expect(errorFields({ ...valid, spendLimit: -25_000 })).toContain("spendLimit")
  })

  it("rejects a limit above the ceiling but accepts the ceiling itself", () => {
    expect(errorFields({ ...valid, spendLimit: MAX_SPEND_LIMIT + 1 })).toContain(
      "spendLimit",
    )
    expect(errorFields({ ...valid, spendLimit: MAX_SPEND_LIMIT })).toEqual([])
  })

  it("rejects an amount that is not integer minor units", () => {
    // A float or a formatted string means the boundary conversion never ran.
    expect(errorFields({ ...valid, spendLimit: 250.5 })).toContain("spendLimit")
    expect(errorFields({ ...valid, spendLimit: "25000" })).toContain("spendLimit")
    expect(errorFields({ ...valid, spendLimit: "$250.00" })).toContain("spendLimit")
    expect(errorFields({ ...valid, spendLimit: NaN })).toContain("spendLimit")
  })

  it("rejects a currency outside the allowlist", () => {
    for (const currency of ["JPY", "usd", "", "USD ", 840, null]) {
      expect(errorFields({ ...valid, currency })).toContain("currency")
    }
    for (const currency of CURRENCIES) {
      // Each allowed currency is valid for a merchant that settles in it.
      const merchantId = { USD: "mch_01", EUR: "mch_05", GBP: "mch_04" }[currency]
      expect(errorFields({ ...valid, merchantId, currency })).toEqual([])
    }
  })

  it("rejects a currency the merchant does not settle in", () => {
    // Brandt & Sohn settles in EUR, so a USD card for them is a support ticket.
    expect(errorFields({ ...valid, merchantId: "mch_05", currency: "USD" })).toContain(
      "currency",
    )
  })

  it("defaults an omitted currency to the merchant's own", () => {
    const result = validateIssueInput({ ...valid, merchantId: "mch_04", currency: undefined })
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.input.currency).toBe("GBP")
  })

  it("rejects a missing nickname and an unknown category", () => {
    expect(errorFields({ ...valid, nickname: "   " })).toContain("nickname")
    expect(errorFields({ ...valid, categoryLock: "gambling" })).toContain(
      "categoryLock",
    )
  })

  it("rejects a body that is not an object", () => {
    expect(errorFields(null)).toContain("body")
    expect(errorFields("nickname=x")).toContain("body")
  })

  it("collects every problem rather than stopping at the first", () => {
    const fields = errorFields({ nickname: "", merchantId: "", spendLimit: 0, currency: "JPY" })
    expect(fields).toEqual(
      expect.arrayContaining(["nickname", "merchantId", "spendLimit", "currency"]),
    )
  })
})

describe("issueCard", () => {
  it("returns a valid test-BIN number once and never stores it", () => {
    const { card, number } = issueCard({
      nickname: "Ad spend",
      merchantId: "mch_01",
      spendLimit: 50_000,
      currency: "USD",
      categoryLock: "advertising",
    })

    expect(number.startsWith("4242")).toBe(true)
    expect(isValidLuhn(number)).toBe(true)
    expect(card.last4).toBe(number.slice(-4))
    // The record must not carry the number under any key.
    expect(JSON.stringify(card)).not.toContain(number)
    expect(cardById(card.id)).toEqual(card)
  })

  it("starts a card active, at zero spend, with an issued event", () => {
    const { card } = issueCard({
      nickname: "Contractor tools",
      merchantId: "mch_02",
      spendLimit: 10_000,
      currency: "USD",
      categoryLock: "contractors",
    })

    expect(card.status).toBe("active")
    expect(cardSpend(card.id)).toBe(0)
    expect(eventsForCard(card.id).map((event) => event.type)).toEqual(["issued"])
  })

  it("stores the created time in UTC", () => {
    const { card } = issueCard(
      {
        nickname: "UTC check",
        merchantId: "mch_01",
        spendLimit: 1_000,
        currency: "USD",
        categoryLock: "any",
      },
      new Date("2026-08-25T14:30:00.000Z"),
    )
    expect(card.createdAt).toBe("2026-08-25T14:30:00.000Z")
  })
})

describe("idempotent issue", () => {
  it("returns the first card for a repeated key instead of issuing twice", () => {
    const key = "issue-test-key-1"
    expect(issuedForKey(key)).toBeNull()

    const before = store.cards.length
    const first = issueCard({
      nickname: "Double click",
      merchantId: "mch_01",
      spendLimit: 5_000,
      currency: "USD",
      categoryLock: "any",
    })
    rememberIdempotencyKey(key, first.card.id)

    const replay = issuedForKey(key)
    expect(replay?.id).toBe(first.card.id)
    expect(store.cards.length).toBe(before + 1)
  })
})

describe("setCardStatus", () => {
  function freshCard() {
    return issueCard({
      nickname: "Transition subject",
      merchantId: "mch_01",
      spendLimit: 5_000,
      currency: "USD",
      categoryLock: "any",
    }).card
  }

  it("freezes and unfreezes, writing an audit event each time", () => {
    const card = freshCard()

    expect(setCardStatus(card.id, "frozen").ok).toBe(true)
    expect(cardById(card.id)?.status).toBe("frozen")
    expect(setCardStatus(card.id, "active").ok).toBe(true)
    expect(cardById(card.id)?.status).toBe("active")

    expect(eventsForCard(card.id).map((event) => event.type)).toEqual([
      "issued",
      "frozen",
      "unfrozen",
    ])
  })

  it("refuses to bring a cancelled card back", () => {
    const card = freshCard()
    expect(setCardStatus(card.id, "cancelled").ok).toBe(true)

    const revive = setCardStatus(card.id, "active")
    expect(revive.ok).toBe(false)
    if (!revive.ok) {
      expect(revive.status).toBe(409)
      expect(revive.message).toMatch(/permanent/i)
    }
    expect(cardById(card.id)?.status).toBe("cancelled")
  })

  it("refuses a status that is not in the allowlist", () => {
    const card = freshCard()
    const result = setCardStatus(card.id, "deleted")
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.status).toBe(422)
    expect(cardById(card.id)?.status).toBe("active")
  })

  it("reports an unknown card as 404", () => {
    const result = setCardStatus("card_does_not_exist", "frozen")
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.status).toBe(404)
  })
})

describe("spend", () => {
  it("sums authorisations rather than reading a stored total", () => {
    const seeded = store.cards.find((card) => card.nickname === "Google Ads · Lumen")!
    const authorisations = store.cardAuthorizations.filter(
      (auth) => auth.cardId === seeded.id,
    )
    const byHand = authorisations.reduce((total, auth) => total + auth.amount, 0)

    expect(cardSpend(seeded.id)).toBe(byHand)
    expect(Number.isInteger(cardSpend(seeded.id))).toBe(true)
  })

  it("puts the seeded advertising card past the amber threshold", () => {
    const seeded = store.cards.find((card) => card.nickname === "Google Ads · Lumen")!
    expect(spendRatio(cardSpend(seeded.id), seeded.spendLimit)).toBeGreaterThan(0.8)
  })

  it("clamps the ratio so a bar cannot overflow", () => {
    expect(spendRatio(0, 10_000)).toBe(0)
    expect(spendRatio(5_000, 10_000)).toBe(0.5)
    expect(spendRatio(20_000, 10_000)).toBe(1)
    expect(spendRatio(100, 0)).toBe(0)
  })
})

describe("listCards", () => {
  it("returns newest first and never exposes a full number", () => {
    const created = listCards().map((card) => card.createdAt)
    expect([...created].sort().reverse()).toEqual(created)
    for (const card of listCards()) {
      expect(Object.keys(card)).not.toContain("number")
      expect(card.last4).toMatch(/^\d{4}$/)
    }
  })
})
