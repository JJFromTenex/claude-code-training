import { afterEach, beforeEach, describe, expect, it } from "vitest"
import type { Card, CardEvent, CardInput, CardStatus } from "./types"
import {
  cardById,
  cardEventsFor,
  createCard,
  listCards,
  parseCardInput,
  setCardStatus,
} from "./cards"
import { store } from "./store"

/**
 * The store layer for cards: the allowlist that turns client input into a
 * CardInput, the reveal-once issue flow, the idempotency guard on a
 * double-clicked issue button, and the status state machine as it actually
 * touches the store and the audit trail. Pure functions (Luhn, mask,
 * canTransition, the limit constants) are covered in ./cards's sibling in
 * src/lib and are not repeated here.
 *
 * The store is a module singleton seeded with 6 cards and 8 events. Every
 * test snapshots and restores store.cards, store.cardEvents and
 * store.issueKeys so cases cannot leak into each other or depend on seed
 * ordering.
 */

let cardsSnapshot: Card[]
let cardEventsSnapshot: CardEvent[]
let issueKeysSnapshot: Record<string, string>

beforeEach(() => {
  cardsSnapshot = store.cards.map((c) => ({ ...c }))
  cardEventsSnapshot = store.cardEvents.map((e) => ({ ...e }))
  issueKeysSnapshot = { ...store.issueKeys }
})

afterEach(() => {
  store.cards.length = 0
  store.cards.push(...cardsSnapshot)
  store.cardEvents.length = 0
  store.cardEvents.push(...cardEventsSnapshot)
  for (const key of Object.keys(store.issueKeys)) delete store.issueKeys[key]
  Object.assign(store.issueKeys, issueKeysSnapshot)
})

/** Seeded card ids, one per status, used as fixed starting points for
 * transition tests. From src/data/generate.ts: crd_01 is active (mch_01,
 * USD), crd_03 is frozen (mch_04, GBP), crd_05 is cancelled (mch_03, USD). */
const SEEDED_ACTIVE_ID = "crd_01"
const SEEDED_FROZEN_ID = "crd_03"
const SEEDED_CANCELLED_ID = "crd_05"

/** A valid raw issue request body. mch_01 settles in USD, the default fixture. */
function validBody(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    merchantId: "mch_01",
    nickname: "Ops card",
    spendLimit: "250.00",
    currency: "USD",
    category: "software",
    ...overrides,
  }
}

/** A valid, already-parsed CardInput, for exercising createCard directly. */
function validInput(overrides: Partial<CardInput> = {}): CardInput {
  return {
    nickname: "Ops card",
    merchantId: "mch_01",
    spendLimit: 25_000,
    currency: "USD",
    category: "software",
    ...overrides,
  }
}

describe("parseCardInput", () => {
  it("rejects a body that is not an object", () => {
    expect(parseCardInput(null)).toEqual({ ok: false, message: "Choose a merchant." })
    expect(parseCardInput("mch_01")).toEqual({
      ok: false,
      message: "Choose a merchant.",
    })
  })

  it("rejects a missing merchant", () => {
    const result = parseCardInput(validBody({ merchantId: undefined }))
    expect(result).toEqual({ ok: false, message: "Choose a merchant." })
  })

  it("rejects an unknown merchant", () => {
    const result = parseCardInput(validBody({ merchantId: "mch_99" }))
    expect(result).toEqual({ ok: false, message: "Choose a merchant." })
  })

  it("rejects an empty nickname", () => {
    const result = parseCardInput(validBody({ nickname: "   " }))
    expect(result).toEqual({ ok: false, message: "Give the card a nickname." })
  })

  it("rejects a limit it cannot parse", () => {
    const result = parseCardInput(validBody({ spendLimit: "twelve dollars" }))
    expect(result).toEqual({
      ok: false,
      message: "Enter a limit like 250 or 250.00.",
    })
  })

  it("rejects a zero limit", () => {
    const result = parseCardInput(validBody({ spendLimit: "0" }))
    expect(result).toEqual({
      ok: false,
      message: "The spend limit must be more than zero.",
    })
  })

  it("rejects a negative limit", () => {
    const result = parseCardInput(validBody({ spendLimit: -100 }))
    expect(result).toEqual({
      ok: false,
      message: "The spend limit must be more than zero.",
    })
  })

  it("rejects a limit above the maximum", () => {
    const result = parseCardInput(validBody({ spendLimit: 5_000_001 }))
    expect(result).toEqual({
      ok: false,
      message: "The spend limit cannot exceed 50,000.00.",
    })
  })

  it("accepts a limit at exactly the maximum", () => {
    const result = parseCardInput(validBody({ spendLimit: 5_000_000 }))
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.value.spendLimit).toBe(5_000_000)
  })

  it("rejects a limit one minor unit above the maximum", () => {
    const result = parseCardInput(validBody({ spendLimit: 5_000_001 }))
    expect(result.ok).toBe(false)
  })

  it("rejects a currency outside USD, EUR, GBP", () => {
    const result = parseCardInput(validBody({ currency: "JPY" }))
    expect(result).toEqual({
      ok: false,
      message: "Currency must be USD, EUR, or GBP.",
    })
  })

  it("rejects an unknown category", () => {
    const result = parseCardInput(validBody({ category: "gambling" }))
    expect(result).toEqual({ ok: false, message: "Choose a valid category." })
  })

  it("rejects a currency that does not match the merchant, naming both", () => {
    // mch_01 is Lumen Coffee Roasters, settling in USD.
    const result = parseCardInput(validBody({ merchantId: "mch_01", currency: "EUR" }))
    expect(result).toEqual({
      ok: false,
      message: "Lumen Coffee Roasters settles in USD; this card must use USD.",
    })
  })

  it("names a GBP merchant correctly on a currency mismatch", () => {
    // mch_04 is Halcyon Studio, settling in GBP.
    const result = parseCardInput(
      validBody({ merchantId: "mch_04", currency: "USD" }),
    )
    expect(result).toEqual({
      ok: false,
      message: "Halcyon Studio settles in GBP; this card must use GBP.",
    })
  })

  it("names a EUR merchant correctly on a currency mismatch", () => {
    // mch_05 is Brandt & Sohn, settling in EUR.
    const result = parseCardInput(
      validBody({ merchantId: "mch_05", currency: "GBP" }),
    )
    expect(result).toEqual({
      ok: false,
      message: "Brandt & Sohn settles in EUR; this card must use EUR.",
    })
  })

  it("converts a decimal limit to minor units exactly once, as an integer", () => {
    const result = parseCardInput(validBody({ spendLimit: "2500.50" }))
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.value.spendLimit).toBe(250_050)
      expect(Number.isInteger(result.value.spendLimit)).toBe(true)
    }
  })

  it("accepts a fully valid body", () => {
    const result = parseCardInput(validBody())
    expect(result).toEqual({
      ok: true,
      value: {
        nickname: "Ops card",
        merchantId: "mch_01",
        spendLimit: 25_000,
        currency: "USD",
        category: "software",
      },
    })
  })
})

describe("createCard", () => {
  it("issues an active card with zero spend and last4 from the full number", () => {
    const { card, fullNumber } = createCard(validInput())
    expect(card.status).toBe("active")
    expect(card.spent).toBe(0)
    expect(fullNumber).toBeDefined()
    expect(card.last4).toBe(fullNumber!.slice(-4))
  })

  it("never leaves a 16-digit run in the stored card, even serialized", () => {
    const { card } = createCard(validInput())
    const serialized = JSON.stringify(card)
    expect(/\d{16}/.test(serialized)).toBe(false)
  })

  it("adds the card to the store", () => {
    const before = store.cards.length
    const { card } = createCard(validInput())
    expect(store.cards.length).toBe(before + 1)
    expect(cardById(card.id)).toEqual(card)
  })
})

describe("createCard idempotency", () => {
  it("replays the same card for a repeated key, without a fullNumber, and creates only one card", () => {
    const before = store.cards.length

    const first = createCard(validInput(), "issue-key-1")
    expect(first.replay).toBe(false)
    expect(first.fullNumber).toBeDefined()

    const second = createCard(validInput(), "issue-key-1")
    expect(second.replay).toBe(true)
    expect(second.card.id).toBe(first.card.id)
    expect(second.fullNumber).toBeUndefined()

    expect(store.cards.length).toBe(before + 1)
  })

  it("issues a distinct card for a different idempotency key", () => {
    const first = createCard(validInput(), "issue-key-a")
    const second = createCard(validInput(), "issue-key-b")
    expect(second.replay).toBe(false)
    expect(second.card.id).not.toBe(first.card.id)
  })

  it("issues a fresh card every time when no key is given", () => {
    const first = createCard(validInput())
    const second = createCard(validInput())
    expect(first.card.id).not.toBe(second.card.id)
    expect(first.replay).toBe(false)
    expect(second.replay).toBe(false)
  })
})

describe("setCardStatus", () => {
  const STATUSES: CardStatus[] = ["active", "frozen", "cancelled"]

  const seededIdFor: Record<CardStatus, string> = {
    active: SEEDED_ACTIVE_ID,
    frozen: SEEDED_FROZEN_ID,
    cancelled: SEEDED_CANCELLED_ID,
  }

  // Mirrors the state machine contract: active <-> frozen, either to
  // cancelled, cancelled is terminal.
  const expected: Record<CardStatus, Record<CardStatus, boolean>> = {
    active: { active: false, frozen: true, cancelled: true },
    frozen: { active: true, frozen: false, cancelled: true },
    cancelled: { active: false, frozen: false, cancelled: false },
  }

  for (const from of STATUSES) {
    for (const to of STATUSES) {
      const label =
        from === to
          ? `rejects a transition from ${from} to itself`
          : `${expected[from][to] ? "allows" : "rejects"} ${from} -> ${to}`

      it(label, () => {
        const id = seededIdFor[from]
        const result = setCardStatus(id, to)

        if (expected[from][to]) {
          expect(result.ok).toBe(true)
          if (result.ok) expect(result.card.status).toBe(to)
        } else {
          expect(result.ok).toBe(false)
          if (!result.ok) {
            expect(result.status).toBe(409)
            expect(result.message).toBe(
              from === "cancelled"
                ? "A cancelled card cannot change status."
                : `That card is already ${from}.`,
            )
          }
        }
      })
    }
  }

  it("treats cancelled as a true terminal state: every move out of it is a 409", () => {
    for (const to of STATUSES) {
      const result = setCardStatus(SEEDED_CANCELLED_ID, to)
      expect(result.ok).toBe(false)
      if (!result.ok) expect(result.status).toBe(409)
    }
  })

  it("returns 404 for an unknown card id", () => {
    const result = setCardStatus("crd_does_not_exist", "frozen")
    expect(result).toEqual({ ok: false, status: 404, message: "No card with that id." })
  })
})

describe("audit trail", () => {
  it("records the issue as an event from null to active", () => {
    const { card } = createCard(validInput())
    const events = cardEventsFor(card.id)
    expect(events).toHaveLength(1)
    expect(events[0].from).toBeNull()
    expect(events[0].to).toBe("active")
  })

  it("appends one event per successful transition, with the correct from/to", () => {
    const { card } = createCard(validInput())

    setCardStatus(card.id, "frozen")
    setCardStatus(card.id, "active")
    setCardStatus(card.id, "cancelled")

    const events = cardEventsFor(card.id)
    expect(events.map((e) => [e.from, e.to])).toEqual([
      [null, "active"],
      ["active", "frozen"],
      ["frozen", "active"],
      ["active", "cancelled"],
    ])
  })

  it("does not append an event for a rejected transition", () => {
    const { card } = createCard(validInput())
    setCardStatus(card.id, "cancelled")
    const before = cardEventsFor(card.id).length

    const rejected = setCardStatus(card.id, "active")
    expect(rejected.ok).toBe(false)
    expect(cardEventsFor(card.id)).toHaveLength(before)
  })

  it("returns events oldest first, scoped to a single card", () => {
    const { card: cardA } = createCard(validInput({ nickname: "Card A" }))
    const { card: cardB } = createCard(validInput({ nickname: "Card B" }))

    setCardStatus(cardA.id, "frozen")
    setCardStatus(cardB.id, "frozen")
    setCardStatus(cardA.id, "cancelled")

    const eventsA = cardEventsFor(cardA.id)
    expect(eventsA.every((e) => e.cardId === cardA.id)).toBe(true)
    expect(eventsA.map((e) => e.to)).toEqual(["active", "frozen", "cancelled"])

    const eventsB = cardEventsFor(cardB.id)
    expect(eventsB.every((e) => e.cardId === cardB.id)).toBe(true)
    expect(eventsB.map((e) => e.to)).toEqual(["active", "frozen"])
  })
})

describe("listCards", () => {
  it("returns every card in the store", () => {
    expect(listCards()).toHaveLength(cardsSnapshot.length)
  })

  it("sorts newest createdAt first", () => {
    const cards = listCards()
    for (let i = 1; i < cards.length; i++) {
      expect(cards[i - 1].createdAt >= cards[i].createdAt).toBe(true)
    }
  })

  it("includes a newly created card", () => {
    const { card } = createCard(validInput())
    const ids = listCards().map((c) => c.id)
    expect(ids).toContain(card.id)
    expect(listCards()).toHaveLength(cardsSnapshot.length + 1)
  })
})

describe("cardById", () => {
  it("finds a seeded card by id", () => {
    const seeded = cardsSnapshot[0]
    expect(cardById(seeded.id)).toEqual(seeded)
  })

  it("returns undefined for an id that does not exist", () => {
    expect(cardById("crd_does_not_exist")).toBeUndefined()
  })
})
