import { isValidLuhn } from "@/lib/cardNumber"
import { randomUUID } from "node:crypto"
import { describe, expect, it } from "vitest"
import { cardById, changeCardStatus, issueCard, listCards } from "./cards"
import { IssueCardInput } from "./cardRules"

const input: IssueCardInput = {
  nickname: "Contractor tools",
  merchantId: "mch_01",
  spendLimit: 25000,
  currency: "USD",
  category: "software",
}

function issue() {
  const result = issueCard(input, randomUUID())
  if (result.status !== "issued") throw new Error("expected a new card")
  return result
}

describe("issueCard", () => {
  it("returns a 4242 Luhn-valid number once and stores only the last four", () => {
    const { card, number } = issue()

    expect(number).toMatch(/^4242\d{12}$/)
    expect(isValidLuhn(number)).toBe(true)
    expect(card.last4).toBe(number.slice(-4))

    const stored = JSON.stringify(cardById(card.id))
    expect(stored).not.toContain(number)
    expect(stored).not.toMatch(/\d{13,}/)
  })

  it("starts active, with no spend and an issue entry in the history", () => {
    const { card } = issue()
    expect(card.status).toBe("active")
    expect(card.spent).toBe(0)
    expect(card.history).toEqual([
      { at: card.createdAt, from: null, to: "active" },
    ])
  })

  it("does not mint a second card when the same request is replayed", () => {
    const key = randomUUID()
    const first = issueCard(input, key)
    const count = listCards().length

    const replay = issueCard(input, key)

    expect(first.status).toBe("issued")
    expect(replay).toEqual({
      status: "duplicate",
      cardId: first.status === "issued" ? first.card.id : "",
    })
    expect(listCards()).toHaveLength(count)
  })
})

describe("changeCardStatus", () => {
  it("freezes and unfreezes, recording each transition", () => {
    const { card } = issue()

    expect(changeCardStatus(card.id, "frozen").status).toBe("ok")
    expect(changeCardStatus(card.id, "active").status).toBe("ok")

    expect(cardById(card.id)!.history.map(({ from, to }) => [from, to])).toEqual([
      [null, "active"],
      ["active", "frozen"],
      ["frozen", "active"],
    ])
  })

  it("refuses to bring a cancelled card back, and leaves it untouched", () => {
    const { card } = issue()
    changeCardStatus(card.id, "cancelled")

    expect(changeCardStatus(card.id, "active")).toEqual({
      status: "invalid_transition",
      from: "cancelled",
    })
    expect(cardById(card.id)!.status).toBe("cancelled")
    expect(cardById(card.id)!.history).toHaveLength(2)
  })

  it("reports an unknown card", () => {
    expect(changeCardStatus("card_nope", "frozen")).toEqual({
      status: "not_found",
    })
  })
})
