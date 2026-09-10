import { describe, expect, it } from "vitest"
import { isValidLuhn } from "@/lib/cards"
import { formatMoney } from "@/lib/money"
import { cardById, changeCardStatus, issueCard, listCards } from "./cards"
import { CardFailure, IssueCardSuccess } from "./cards"
import { MAX_SPEND_LIMIT } from "./types"

const valid = {
  nickname: "Ad spend",
  merchantId: "mch_01",
  currency: "USD",
  spendLimit: 25000,
}

function issued(overrides: Record<string, unknown> = {}): IssueCardSuccess {
  const result = issueCard({ ...valid, ...overrides })
  if (!result.ok) throw new Error(`expected success, got ${result.error}`)
  return result
}

function rejected(overrides: Record<string, unknown>): CardFailure {
  const result = issueCard({ ...valid, ...overrides })
  if (result.ok) throw new Error("expected a rejection")
  return result
}

describe("issueCard", () => {
  it("mints a 4242 test-BIN number with a valid check digit, exactly once", () => {
    const result = issued({ nickname: "Luhn card" })

    expect(result.replayed).toBe(false)
    expect(result.number).toMatch(/^4242\d{12}$/)
    expect(isValidLuhn(result.number!)).toBe(true)
    expect(result.card.last4).toBe(result.number!.slice(-4))
  })

  it("stores the last four and a reference, never the number", () => {
    const { card, number } = issued({ nickname: "Masked card" })

    expect(Object.keys(card).sort()).toEqual(
      [
        "categoryLock",
        "createdAt",
        "currency",
        "history",
        "id",
        "idempotencyKey",
        "last4",
        "merchantId",
        "nickname",
        "numberRef",
        "spendLimit",
        "spent",
        "status",
      ].sort(),
    )
    expect(JSON.stringify(card)).not.toContain(number)
    expect(card.numberRef).toMatch(/^pan_/)
  })

  it("issues active, with a spend of zero and the issue in its history", () => {
    const { card } = issued({ nickname: "Fresh card" })

    expect(card.status).toBe("active")
    expect(card.spent).toBe(0)
    expect(card.history).toEqual([
      { from: null, to: "active", at: card.createdAt },
    ])
  })

  it("trims the nickname", () => {
    expect(issued({ nickname: "  Padded  " }).card.nickname).toBe("Padded")
  })

  it("puts the new card at the top of the list", () => {
    const { card } = issued({ nickname: "Newest card" })
    const cards = listCards()

    expect(cards[0].id).toBe(card.id)
    expect(cards.map((c) => c.id)).toContain(card.id)
    expect(cardById(card.id)).toEqual(card)
  })

  it("rejects a body that is not an object", () => {
    expect(issueCard(null)).toMatchObject({ ok: false, status: 400 })
    expect(issueCard("card")).toMatchObject({ ok: false, status: 400 })
    expect(issueCard([])).toMatchObject({ ok: false, status: 400 })
  })

  it("rejects a blank or oversized nickname", () => {
    expect(rejected({ nickname: "   " }).error).toBe("Give the card a nickname")
    expect(rejected({ nickname: 7 }).error).toBe("Give the card a nickname")
    expect(rejected({ nickname: "n".repeat(41) }).error).toBe(
      "Nickname must be 40 characters or fewer",
    )
    expect(issued({ nickname: "n".repeat(40) }).card.nickname).toHaveLength(40)
  })

  it("rejects a missing merchant and an unknown merchant differently", () => {
    expect(rejected({ merchantId: undefined }).error).toBe("Choose a merchant")
    expect(rejected({ merchantId: "mch_99" }).error).toBe("Unknown merchant")
  })

  it("rejects a currency outside the allowlist", () => {
    const failure = rejected({ currency: "JPY" })
    expect(failure.status).toBe(400)
    expect(failure.error).toBe("Currency must be USD, EUR, or GBP")
  })

  it("rejects a currency the merchant does not settle in", () => {
    const failure = rejected({ merchantId: "mch_05", currency: "USD" })
    expect(failure.error).toBe(
      "Brandt & Sohn settles in EUR; issue the card in EUR.",
    )
    expect(issued({ merchantId: "mch_05", currency: "EUR" }).card.currency).toBe(
      "EUR",
    )
  })

  it("rejects a limit that is not a positive integer of minor units", () => {
    expect(rejected({ spendLimit: 0 }).error).toBe(
      "Spend limit must be greater than zero",
    )
    expect(rejected({ spendLimit: -25000 }).error).toBe(
      "Spend limit must be greater than zero",
    )
    expect(rejected({ spendLimit: 250.5 }).status).toBe(400)
    expect(rejected({ spendLimit: "25000" }).status).toBe(400)
    expect(rejected({ spendLimit: undefined }).status).toBe(400)
  })

  it("accepts the maximum limit and rejects one minor unit above it", () => {
    expect(issued({ spendLimit: MAX_SPEND_LIMIT }).card.spendLimit).toBe(
      MAX_SPEND_LIMIT,
    )
    expect(rejected({ spendLimit: MAX_SPEND_LIMIT + 1 }).error).toBe(
      `Spend limit cannot exceed ${formatMoney(MAX_SPEND_LIMIT, "USD")}`,
    )
  })

  it("stores a known category lock and rejects an unknown one", () => {
    expect(issued({ categoryLock: "advertising" }).card.categoryLock).toBe(
      "advertising",
    )
    expect(issued({ categoryLock: null }).card.categoryLock).toBeNull()
    expect(issued({}).card.categoryLock).toBeNull()
    expect(rejected({ categoryLock: "gambling" }).status).toBe(400)
  })

  it("rejects an idempotency key that is not a usable string", () => {
    expect(rejected({ idempotencyKey: "" }).status).toBe(400)
    expect(rejected({ idempotencyKey: "k".repeat(129) }).status).toBe(400)
    expect(rejected({ idempotencyKey: 12 }).status).toBe(400)
  })

  it("replays a retried issue without minting a second card or the number", () => {
    const key = `test-replay-${Date.now()}`
    const first = issued({ nickname: "Retried card", idempotencyKey: key })
    const before = listCards().length

    const second = issued({ nickname: "Retried card", idempotencyKey: key })

    expect(second.replayed).toBe(true)
    expect(second.number).toBeNull()
    expect(second.card.id).toBe(first.card.id)
    expect(listCards()).toHaveLength(before)
  })
})

describe("changeCardStatus", () => {
  it("freezes and unfreezes, appending to history each time", () => {
    const { card } = issued({ nickname: "Freezable card" })

    const frozen = changeCardStatus(card.id, { status: "frozen" })
    expect(frozen).toMatchObject({ ok: true })
    expect(cardById(card.id)!.status).toBe("frozen")

    const thawed = changeCardStatus(card.id, { status: "active" })
    expect(thawed).toMatchObject({ ok: true })

    const after = cardById(card.id)!
    expect(after.status).toBe("active")
    expect(after.history.map((e) => [e.from, e.to])).toEqual([
      [null, "active"],
      ["active", "frozen"],
      ["frozen", "active"],
    ])
  })

  it("cancels an active card", () => {
    const { card } = issued({ nickname: "Cancellable card" })

    expect(changeCardStatus(card.id, { status: "cancelled" })).toMatchObject({
      ok: true,
    })
    expect(cardById(card.id)!.status).toBe("cancelled")
  })

  it("treats cancelled as terminal", () => {
    const { card } = issued({ nickname: "Terminal card" })
    changeCardStatus(card.id, { status: "cancelled" })

    for (const status of ["active", "frozen"] as const) {
      const failure = changeCardStatus(card.id, { status })
      expect(failure).toMatchObject({
        ok: false,
        status: 409,
        error: "A cancelled card cannot be changed",
      })
    }
    expect(cardById(card.id)!.status).toBe("cancelled")
    expect(cardById(card.id)!.history).toHaveLength(2)
  })

  it("refuses a transition to the status the card is already in", () => {
    const { card } = issued({ nickname: "Idle card" })
    changeCardStatus(card.id, { status: "frozen" })

    const failure = changeCardStatus(card.id, { status: "frozen" })
    expect(failure).toMatchObject({ ok: false, status: 409 })
    expect((failure as CardFailure).error).toBe("Card is already frozen")
  })

  it("404s an unknown card", () => {
    expect(changeCardStatus("card_9999", { status: "frozen" })).toMatchObject({
      ok: false,
      status: 404,
      error: "Card not found",
    })
  })

  it("400s a status outside the allowlist, before it looks the card up", () => {
    const { card } = issued({ nickname: "Guarded card" })

    expect(changeCardStatus(card.id, { status: "expired" })).toMatchObject({
      ok: false,
      status: 400,
    })
    expect(changeCardStatus(card.id, { status: 3 })).toMatchObject({
      ok: false,
      status: 400,
    })
    expect(changeCardStatus(card.id, null)).toMatchObject({
      ok: false,
      status: 400,
    })
    expect(cardById(card.id)!.status).toBe("active")
  })
})
