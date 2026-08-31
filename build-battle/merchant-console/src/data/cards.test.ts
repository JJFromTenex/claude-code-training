import { beforeEach, describe, expect, it } from "vitest"
import { isValidLuhn } from "@/lib/cards"
import {
  CARD_STATUSES,
  MAX_CARD_LIMIT,
  cardById,
  cardsForMerchant,
  createCard,
  filterCards,
  parseCardFilters,
  queryCards,
  sortCards,
  transitionCardStatus,
} from "./cards"
import { store } from "./store"
import { Card } from "./types"

/**
 * The client is not trusted, so these are the tests that matter most: every
 * rejection the ticket names, plus the guarantee that the stored record never
 * carries a full number. A card issued with the wrong limit is the incident
 * NWP-201 exists to prevent.
 */

const valid = {
  nickname: "Ad spend — Q3",
  merchantId: "mch_01",
  limit: 25000,
  currency: "USD",
}

beforeEach(() => {
  // The store is a module singleton; each test starts with no cards.
  store.cards.length = 0
})

function issue(overrides: Record<string, unknown> = {}) {
  return createCard({ ...valid, ...overrides })
}

describe("createCard", () => {
  it("issues a card on the test BIN with a valid Luhn digit", () => {
    const result = issue()
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.value.number).toMatch(/^4242\d{12}$/)
    expect(isValidLuhn(result.value.number)).toBe(true)
  })

  it("returns the full number once and never stores it", () => {
    const result = issue()
    if (!result.ok) throw new Error("expected the card to be issued")

    const { card, number } = result.value
    expect(card.last4).toBe(number.slice(-4))
    // The record has no field holding the number, under any name.
    expect(JSON.stringify(card)).not.toContain(number)
    expect(JSON.stringify(store.cards)).not.toContain(number)
  })

  it("stores a reference to the number, so the card can be reconciled later", () => {
    const result = issue()
    if (!result.ok) throw new Error("expected the card to be issued")
    expect(result.value.card.reference).toMatch(/^cref_[0-9a-f]{32}$/)
  })

  it("keeps the reference independent of the number it references", () => {
    const result = issue()
    if (!result.ok) throw new Error("expected the card to be issued")

    const { card, number } = result.value
    // A reference that encodes the number is a number in disguise: the BIN is
    // fixed and the last four are stored, so anything derived is brute-forceable.
    expect(card.reference).not.toContain(number)
    expect(card.reference).not.toContain(number.slice(4, 12))
    expect(card.reference).not.toContain(card.last4)
  })

  it("gives every card a distinct reference", () => {
    const references = new Set<string>()
    for (let i = 0; i < 25; i++) {
      const result = issue()
      if (!result.ok) throw new Error("expected the card to be issued")
      references.add(result.value.card.reference)
    }
    expect(references.size).toBe(25)
  })

  it("starts a card active, unspent, and stamped in UTC", () => {
    const result = issue()
    if (!result.ok) throw new Error("expected the card to be issued")
    expect(result.value.card.status).toBe("active")
    expect(result.value.card.spent).toBe(0)
    expect(result.value.card.createdAt).toMatch(/Z$/)
  })

  it("keeps the limit as the integer minor units it was given", () => {
    const result = issue({ limit: 123456 })
    if (!result.ok) throw new Error("expected the card to be issued")
    expect(result.value.card.limit).toBe(123456)
    expect(Number.isInteger(result.value.card.limit)).toBe(true)
  })

  it("rejects a missing merchant", () => {
    const result = createCard({ ...valid, merchantId: undefined })
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error.field).toBe("merchantId")
  })

  it("rejects a merchant that does not exist", () => {
    const result = issue({ merchantId: "mch_nope" })
    expect(result.ok).toBe(false)
  })

  it("rejects a zero or negative limit", () => {
    expect(issue({ limit: 0 }).ok).toBe(false)
    expect(issue({ limit: -5000 }).ok).toBe(false)
  })

  it("rejects a limit above the cap but allows the cap itself", () => {
    expect(issue({ limit: MAX_CARD_LIMIT + 1 }).ok).toBe(false)
    expect(issue({ limit: MAX_CARD_LIMIT }).ok).toBe(true)
  })

  it("rejects a limit that is not an integer number of minor units", () => {
    // A float or a string here means a client skipped its conversion.
    expect(issue({ limit: 1000.5 }).ok).toBe(false)
    expect(issue({ limit: "1000" }).ok).toBe(false)
    expect(issue({ limit: null }).ok).toBe(false)
  })

  it("rejects a currency outside the allowlist", () => {
    expect(issue({ currency: "JPY" }).ok).toBe(false)
    expect(issue({ currency: "usd" }).ok).toBe(false)
    expect(issue({ currency: undefined }).ok).toBe(false)
  })

  it("accepts each allowed currency", () => {
    for (const currency of ["USD", "EUR", "GBP"]) {
      expect(issue({ currency }).ok).toBe(true)
    }
  })

  it("rejects a blank nickname, whitespace included", () => {
    expect(issue({ nickname: "" }).ok).toBe(false)
    expect(issue({ nickname: "   " }).ok).toBe(false)
  })

  it("does not consume a card id when validation fails", () => {
    issue({ limit: 0 })
    expect(store.cards).toHaveLength(0)
  })

  it("treats a blank category as unrestricted", () => {
    const result = issue({ category: "   " })
    if (!result.ok) throw new Error("expected the card to be issued")
    expect(result.value.card.category).toBeNull()
  })

  it("keeps a category lock when one is chosen", () => {
    const result = issue({ category: "Advertising" })
    if (!result.ok) throw new Error("expected the card to be issued")
    expect(result.value.card.category).toBe("Advertising")
  })

  it("gives every card a distinct number and id", () => {
    const numbers = new Set<string>()
    const ids = new Set<string>()
    for (let i = 0; i < 25; i++) {
      const result = issue()
      if (!result.ok) throw new Error("expected the card to be issued")
      numbers.add(result.value.number)
      ids.add(result.value.card.id)
    }
    expect(numbers.size).toBe(25)
    expect(ids.size).toBe(25)
  })
})

describe("transitionCardStatus", () => {
  let card: Card

  beforeEach(() => {
    const result = issue()
    if (!result.ok) throw new Error("expected the card to be issued")
    card = result.value.card
  })

  it("freezes and unfreezes an active card", () => {
    expect(transitionCardStatus(card.id, "frozen")).toMatchObject({ ok: true })
    expect(cardById(card.id)?.status).toBe("frozen")
    expect(transitionCardStatus(card.id, "active")).toMatchObject({ ok: true })
    expect(cardById(card.id)?.status).toBe("active")
  })

  it("cancels from either live state", () => {
    expect(transitionCardStatus(card.id, "cancelled")).toMatchObject({ ok: true })

    const second = issue()
    if (!second.ok) throw new Error("expected the card to be issued")
    transitionCardStatus(second.value.card.id, "frozen")
    expect(transitionCardStatus(second.value.card.id, "cancelled")).toMatchObject(
      { ok: true },
    )
  })

  it("refuses to bring a cancelled card back, and leaves it cancelled", () => {
    transitionCardStatus(card.id, "cancelled")
    for (const to of ["active", "frozen", "cancelled"]) {
      const result = transitionCardStatus(card.id, to)
      expect(result).toMatchObject({ ok: false })
    }
    expect(cardById(card.id)?.status).toBe("cancelled")
  })

  it("rejects a status that is not a status", () => {
    expect(transitionCardStatus(card.id, "melted")).toMatchObject({ ok: false })
    expect(transitionCardStatus(card.id, undefined)).toMatchObject({ ok: false })
    // "all" is a filter word, not a state a card can be in.
    expect(transitionCardStatus(card.id, "all")).toMatchObject({ ok: false })
    expect(cardById(card.id)?.status).toBe("active")
  })

  it("reports a missing card as missing rather than invalid", () => {
    expect(transitionCardStatus("card_9999", "frozen")).toBeNull()
  })
})

describe("parseCardFilters", () => {
  it("falls back to safe defaults for junk input", () => {
    const filters = parseCardFilters(
      new URLSearchParams({ status: "melted", sort: "nope", page: "-3" }),
    )
    expect(filters.status).toBe("all")
    expect(filters.sort).toBe("createdAt")
    expect(filters.direction).toBe("desc")
    expect(filters.page).toBe(1)
  })

  it("keeps a status the allowlist recognises", () => {
    for (const status of CARD_STATUSES) {
      expect(parseCardFilters(new URLSearchParams({ status })).status).toBe(status)
    }
  })

  it("accepts the sort fields the table offers", () => {
    expect(parseCardFilters(new URLSearchParams({ sort: "limit" })).sort).toBe(
      "limit",
    )
    expect(
      parseCardFilters(new URLSearchParams({ direction: "asc" })).direction,
    ).toBe("asc")
  })
})

describe("filterCards and sortCards", () => {
  beforeEach(() => {
    issue({ nickname: "Ad spend", merchantId: "mch_01", limit: 30000 })
    issue({
      nickname: "Contractor tools",
      merchantId: "mch_04",
      limit: 10000,
      currency: "GBP",
    })
    issue({ nickname: "Travel", merchantId: "mch_01", limit: 20000 })
  })

  it("returns everything when nothing is filtered", () => {
    expect(filterCards({})).toHaveLength(3)
    expect(filterCards({ status: "all" })).toHaveLength(3)
  })

  it("filters by status", () => {
    const [first] = store.cards
    transitionCardStatus(first.id, "frozen")
    expect(filterCards({ status: "frozen" })).toHaveLength(1)
    expect(filterCards({ status: "active" })).toHaveLength(2)
  })

  it("filters by merchant", () => {
    expect(filterCards({ merchantId: "mch_01" })).toHaveLength(2)
    expect(cardsForMerchant("mch_04")).toHaveLength(1)
  })

  it("searches nickname, id, last four, and merchant name", () => {
    expect(filterCards({ search: "contractor" })).toHaveLength(1)
    expect(filterCards({ search: "Lumen" })).toHaveLength(2)

    const target = store.cards[0]
    expect(filterCards({ search: target.last4 })).toContainEqual(target)
    expect(filterCards({ search: target.id })).toContainEqual(target)
  })

  it("sorts by limit in both directions without mutating the input", () => {
    const input = filterCards({})
    const ascending = sortCards(input, "limit", "asc").map((c) => c.limit)
    expect(ascending).toEqual([10000, 20000, 30000])
    expect(sortCards(input, "limit", "desc").map((c) => c.limit)).toEqual([
      30000, 20000, 10000,
    ])
    // sortCards copies rather than reordering the caller's array.
    expect(filterCards({}).map((c) => c.limit)).toEqual(
      input.map((c) => c.limit),
    )
  })

  it("shows the newest card first by default", () => {
    const { rows } = queryCards(parseCardFilters(new URLSearchParams()))
    const timestamps = rows.map((c) => c.createdAt)
    expect([...timestamps].sort().reverse()).toEqual(timestamps)
  })

  it("paginates through the shared helper", () => {
    const result = queryCards({ page: 1, pageSize: 2 })
    expect(result.rows).toHaveLength(2)
    expect(result.total).toBe(3)
    expect(result.pageCount).toBe(2)
  })
})
