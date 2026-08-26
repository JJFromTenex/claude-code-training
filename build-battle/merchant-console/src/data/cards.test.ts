import { beforeEach, describe, expect, it } from "vitest"
import { merchants } from "@/data/merchants"
import { store } from "@/data/store"
import { issueCard, setCardStatus } from "./cards"

describe("setCardStatus", () => {
  beforeEach(() => {
    store.cards.length = 0
  })

  const issue = () =>
    issueCard({
      nickname: "Ad spend",
      merchantId: merchants[0].id,
      limitMinorUnits: 25000,
      currency: "USD",
      category: "advertising",
    }).card

  it("stores the category chosen at issue time", () => {
    expect(issue().category).toBe("advertising")
  })

  it("moves active to frozen", () => {
    const { card } = { card: issue() }
    const result = setCardStatus(card.id, "frozen")
    expect("card" in result && result.card.status).toBe("frozen")
  })

  it("moves frozen back to active", () => {
    const card = issue()
    setCardStatus(card.id, "frozen")
    const result = setCardStatus(card.id, "active")
    expect("card" in result && result.card.status).toBe("active")
  })

  it("moves active to cancelled", () => {
    const card = issue()
    const result = setCardStatus(card.id, "cancelled")
    expect("card" in result && result.card.status).toBe("cancelled")
  })

  it("moves frozen to cancelled", () => {
    const card = issue()
    setCardStatus(card.id, "frozen")
    const result = setCardStatus(card.id, "cancelled")
    expect("card" in result && result.card.status).toBe("cancelled")
  })

  it("rejects cancelled to active — cancelled is terminal", () => {
    const card = issue()
    setCardStatus(card.id, "cancelled")
    const result = setCardStatus(card.id, "active")
    expect("error" in result).toBe(true)
  })

  it("rejects cancelled to frozen", () => {
    const card = issue()
    setCardStatus(card.id, "cancelled")
    const result = setCardStatus(card.id, "frozen")
    expect("error" in result).toBe(true)
  })

  it("rejects a status on an unknown card", () => {
    const result = setCardStatus("card_missing", "active")
    expect("error" in result).toBe(true)
  })
})
