import { describe, expect, it } from "vitest"
import { isLuhnValid } from "@/lib/cards"
import {
  applyAction,
  issueCard,
  IssueValues,
  parseIssue,
  Rejection,
} from "./cards"
import { store } from "./store"

/**
 * The server side of NWP-201. The store is in memory, so these run the real
 * path a route handler takes. Counts are measured relative to the store, so
 * the file does not care what ran before it.
 */

const valid = {
  nickname: "  Ad spend  ",
  merchantId: "mch_01",
  spendLimit: 25000,
  currency: "USD",
  categoryLock: "advertising",
}

const reject = (body: unknown): Rejection => parseIssue(body) as Rejection
const accept = (body: unknown): IssueValues => parseIssue(body) as IssueValues

/** Issue a card and fail loudly rather than returning a Rejection. */
function issue(
  overrides: Record<string, unknown> = {},
  key: string | null = null,
) {
  const values = accept({ ...valid, ...overrides })
  const result = issueCard(values, key)
  if ("status" in result) throw new Error(result.message)
  return result
}

describe("parseIssue", () => {
  it("accepts a good body and trims the nickname", () => {
    expect(accept(valid)).toEqual({
      nickname: "Ad spend",
      merchantId: "mch_01",
      spendLimit: 25000,
      currency: "USD",
      categoryLock: "advertising",
    })
  })

  it.each([
    ["no merchant", { merchantId: undefined }],
    ["an unknown merchant", { merchantId: "mch_99" }],
    ["no nickname", { nickname: "   " }],
    ["a zero limit", { spendLimit: 0 }],
    ["a negative limit", { spendLimit: -1 }],
    ["a limit above the cap", { spendLimit: 5_000_001 }],
    ["a fractional limit", { spendLimit: 250.5 }],
    ["a limit sent as a string", { spendLimit: "25000" }],
    ["a currency off the allowlist", { currency: "JPY" }],
    ["a category off the allowlist", { categoryLock: "yachts" }],
  ])("rejects %s with a 400 and a readable message", (_label, overrides) => {
    const rejection = reject({ ...valid, ...overrides })
    expect(rejection.status).toBe(400)
    expect(rejection.message).toBeTruthy()
  })

  it("accepts exactly 5,000,000 and refuses one more", () => {
    expect(accept({ ...valid, spendLimit: 5_000_000 })).toMatchObject({
      spendLimit: 5_000_000,
    })
  })

  it("refuses a currency the merchant cannot settle in", () => {
    // mch_05 (Brandt & Sohn) settles in EUR.
    const rejection = reject({
      ...valid,
      merchantId: "mch_05",
      currency: "GBP",
    })
    expect(rejection.status).toBe(422)
    expect(rejection.message).toContain("EUR")
  })

  it("allows a card with no category lock", () => {
    expect(accept({ ...valid, categoryLock: null }).categoryLock).toBeNull()
  })
})

describe("issueCard", () => {
  it("stores the last four and nothing that could rebuild the number", () => {
    const { card, fullNumber } = issue({ nickname: "Masking" })

    expect(fullNumber).not.toBeNull()
    expect(isLuhnValid(fullNumber!)).toBe(true)
    expect(card.last4).toBe(fullNumber!.slice(-4))
    // The record is what every list and detail payload is built from.
    expect(JSON.stringify(card)).not.toContain(fullNumber!)
    expect(card.status).toBe("active")
    expect(card.spent).toBe(0)
  })

  it("replays an idempotency key instead of minting a second card", () => {
    const before = store.cards.length
    const first = issue({ nickname: "Retry" }, "key-retry")
    const second = issue({ nickname: "Retry" }, "key-retry")

    expect(second.card.id).toBe(first.card.id)
    expect(store.cards.length).toBe(before + 1)
    // The reveal happens once. A replay returns the record without the number.
    expect(second.fullNumber).toBeNull()
  })

  it("refuses a key reused for a different card", () => {
    issue({ nickname: "Original" }, "key-conflict")
    const values = accept({ ...valid, nickname: "Different" })
    const result = issueCard(values, "key-conflict") as Rejection
    expect(result.status).toBe(409)
  })
})

describe("applyAction", () => {
  it("walks active to frozen and back, then cancels for good", () => {
    const { card } = issue({ nickname: "Machine" })

    expect(applyAction(card.id, "freeze")).toMatchObject({
      card: { status: "frozen" },
    })
    expect(applyAction(card.id, "unfreeze")).toMatchObject({
      card: { status: "active" },
    })
    expect(applyAction(card.id, "cancel")).toMatchObject({
      card: { status: "cancelled" },
    })

    // Terminal, both ways out.
    expect(applyAction(card.id, "unfreeze")).toMatchObject({ status: 409 })
    expect(applyAction(card.id, "freeze")).toMatchObject({ status: 409 })
    expect(card.status).toBe("cancelled")
  })

  it("refuses a transition the card is already in", () => {
    const { card } = issue({ nickname: "No-op" })
    applyAction(card.id, "freeze")
    expect(applyAction(card.id, "freeze")).toMatchObject({ status: 409 })
  })

  it("appends every transition to the audit trail, in order", () => {
    const { card } = issue({ nickname: "Trail" })
    applyAction(card.id, "freeze")
    applyAction(card.id, "unfreeze")

    const trail = store.cardEvents
      .filter((e) => e.cardId === card.id)
      .map((e) => `${e.from ?? "new"}->${e.to}`)
    expect(trail).toEqual(["new->active", "active->frozen", "frozen->active"])
  })

  it("is a 404 for an id that was never issued", () => {
    expect(applyAction("card_999999", "freeze")).toMatchObject({ status: 404 })
  })
})
