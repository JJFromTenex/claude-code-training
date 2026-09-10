import { beforeEach, describe, expect, it } from "vitest"
import { Card, CardStatus } from "./types"
import {
  CARD_CATEGORIES,
  IssueCardInput,
  MAX_SPEND_LIMIT,
  cardById,
  issueCard,
  listCards,
  setCardStatus,
  validateIssueInput,
} from "./cards"
import { store } from "./store"

/**
 * The client is not trusted, so these tests sit on the boundary rather than on
 * the form. Each one is a request someone can send with curl: a limit that is
 * really a float, a currency the console never offered, a cancelled card being
 * asked to come back. The last block is the one that matters most — a full
 * card number must not survive anywhere a later read can reach.
 */

const valid = {
  nickname: "Meta Ads",
  merchantId: "mch_01",
  spendLimit: 25000,
  currency: "USD",
  category: "advertising",
}

describe("validateIssueInput", () => {
  it("accepts a well-formed request and trims the nickname", () => {
    const result = validateIssueInput({ ...valid, nickname: "  Meta Ads  " })
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.value.nickname).toBe("Meta Ads")
  })

  it("rejects a body that is not an object", () => {
    expect(validateIssueInput("nope").ok).toBe(false)
    expect(validateIssueInput(null).ok).toBe(false)
  })

  it("requires a nickname", () => {
    const result = validateIssueInput({ ...valid, nickname: "   " })
    expect(result).toMatchObject({ ok: false, status: 400, field: "nickname" })
  })

  it("requires a merchant, and one that exists", () => {
    expect(validateIssueInput({ ...valid, merchantId: "" })).toMatchObject({
      ok: false,
      status: 400,
      field: "merchantId",
    })
    expect(
      validateIssueInput({ ...valid, merchantId: "mch_nope" }),
    ).toMatchObject({ ok: false, status: 400, field: "merchantId" })
  })

  it("rejects a limit that is not an integer count of minor units", () => {
    // "250.00" is what an unconverted form field looks like, and 250.5 is
    // what float money looks like. Neither is a limit.
    for (const spendLimit of ["25000", 250.5, NaN, Infinity, null]) {
      expect(validateIssueInput({ ...valid, spendLimit })).toMatchObject({
        ok: false,
        status: 400,
        field: "spendLimit",
      })
    }
  })

  it("rejects a zero or negative limit", () => {
    expect(validateIssueInput({ ...valid, spendLimit: 0 })).toMatchObject({
      ok: false,
      field: "spendLimit",
    })
    expect(validateIssueInput({ ...valid, spendLimit: -1 })).toMatchObject({
      ok: false,
      field: "spendLimit",
    })
  })

  it("allows the ceiling and refuses one minor unit above it", () => {
    expect(
      validateIssueInput({ ...valid, spendLimit: MAX_SPEND_LIMIT }).ok,
    ).toBe(true)
    expect(
      validateIssueInput({ ...valid, spendLimit: MAX_SPEND_LIMIT + 1 }),
    ).toMatchObject({ ok: false, field: "spendLimit" })
  })

  it("accepts only the three currencies the console supports", () => {
    for (const currency of ["USD", "EUR", "GBP"]) {
      expect(validateIssueInput({ ...valid, currency }).ok).toBe(true)
    }
    for (const currency of ["JPY", "usd", "", 840, null]) {
      expect(validateIssueInput({ ...valid, currency })).toMatchObject({
        ok: false,
        field: "currency",
      })
    }
  })

  it("treats a category as optional but allowlisted when given", () => {
    expect(validateIssueInput({ ...valid, category: undefined }).ok).toBe(true)
    expect(validateIssueInput({ ...valid, category: "" }).ok).toBe(true)
    for (const category of CARD_CATEGORIES) {
      expect(validateIssueInput({ ...valid, category }).ok).toBe(true)
    }
    expect(
      validateIssueInput({ ...valid, category: "crypto" }),
    ).toMatchObject({ ok: false, field: "category" })
  })
})

describe("issueCard", () => {
  const input: IssueCardInput = {
    nickname: "Meta Ads",
    merchantId: "mch_01",
    spendLimit: 25000,
    currency: "USD",
    category: "advertising",
  }

  it("returns the full number once and keeps only its last four", () => {
    const { card, cardNumber } = issueCard(input)
    expect(cardNumber).toMatch(/^4242\d{12}$/)
    expect(card.last4).toBe(cardNumber.slice(-4))
  })

  it("never writes the number onto the record it stores", () => {
    const { card, cardNumber } = issueCard(input)
    const stored = cardById(card.id)!
    expect(JSON.stringify(stored)).not.toContain(cardNumber)
    expect(stored.reference).not.toContain(cardNumber.slice(0, 12))
  })

  it("keeps no full number anywhere a list or detail read can reach", () => {
    const { cardNumber } = issueCard(input)
    expect(JSON.stringify(listCards())).not.toContain(cardNumber)
  })

  it("starts a card active, unspent, and with an issue event", () => {
    const { card } = issueCard(input)
    expect(card.status).toBe("active")
    expect(card.spent).toBe(0)
    expect(card.history).toHaveLength(1)
    expect(card.history[0].status).toBe("active")
  })

  it("lists the newest card first", () => {
    const { card } = issueCard(input, new Date("2099-01-01T00:00:00.000Z"))
    expect(listCards()[0].id).toBe(card.id)
  })
})

describe("setCardStatus", () => {
  let card: Card

  beforeEach(() => {
    card = issueCard({
      nickname: "Freeze me",
      merchantId: "mch_01",
      spendLimit: 25000,
      currency: "USD",
      category: null,
    }).card
  })

  it("freezes and unfreezes an active card, recording each step", () => {
    expect(setCardStatus(card.id, "frozen").ok).toBe(true)
    expect(cardById(card.id)!.status).toBe("frozen")
    expect(setCardStatus(card.id, "active").ok).toBe(true)
    expect(cardById(card.id)!.status).toBe("active")
    expect(cardById(card.id)!.history.map((e) => e.status)).toEqual([
      "active",
      "frozen",
      "active",
    ])
  })

  it("refuses to bring a cancelled card back, whatever is asked for", () => {
    setCardStatus(card.id, "cancelled")
    for (const next of ["active", "frozen", "cancelled"] as CardStatus[]) {
      expect(setCardStatus(card.id, next)).toMatchObject({
        ok: false,
        status: 409,
      })
    }
    expect(cardById(card.id)!.status).toBe("cancelled")
  })

  it("refuses a status the card already holds", () => {
    expect(setCardStatus(card.id, "active")).toMatchObject({
      ok: false,
      status: 409,
    })
  })

  it("rejects a status that is not one of the three", () => {
    expect(setCardStatus(card.id, "melted")).toMatchObject({
      ok: false,
      status: 400,
    })
    expect(setCardStatus(card.id, 1)).toMatchObject({ ok: false, status: 400 })
  })

  it("reports an unknown card as missing rather than invalid", () => {
    expect(setCardStatus("card_nope", "frozen")).toMatchObject({
      ok: false,
      status: 404,
    })
  })
})

describe("the seeded cards", () => {
  it("are all on the test BIN, so nothing here resembles a real PAN", () => {
    for (const card of store.cards) {
      expect(card.last4).toMatch(/^\d{4}$/)
    }
    expect(JSON.stringify(store.cards)).not.toMatch(/\d{13,}/)
  })
})
