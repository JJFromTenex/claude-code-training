import { describe, expect, it } from "vitest"
import { Payment } from "./types"
import { sortPayments } from "./queries"

/**
 * Amount sorting is the ops workflow behind "show me the biggest disputes
 * first", and it feeds the CSV export as well as the table. Comparing minor
 * units as strings ordered them lexicographically, so $90.00 outranked
 * $100.00 and the largest payment was never at the top.
 */

const payment: Payment = {
  id: "pay_0001",
  merchantId: "mch_01",
  amount: 25000,
  currency: "USD",
  status: "captured",
  method: "card",
  cardBrand: "visa",
  last4: "4242",
  createdAt: "2026-03-14T10:15:00.000Z",
  description: "Order 1180",
}

const at = (id: string, amount: number, createdAt: string): Payment => ({
  ...payment,
  id,
  amount,
  createdAt,
})

describe("sortPayments by amount", () => {
  it("orders by numeric value, so $100.00 outranks $90.00", () => {
    const rows = [
      at("a", 9000, "2026-03-01T00:00:00.000Z"),
      at("b", 10000, "2026-03-02T00:00:00.000Z"),
    ]
    expect(sortPayments(rows, "amount", "desc").map((p) => p.id)).toEqual([
      "b",
      "a",
    ])
  })

  it("orders ascending smallest first across an order of magnitude", () => {
    const rows = [
      at("a", 100000, "2026-03-01T00:00:00.000Z"),
      at("b", 900, "2026-03-02T00:00:00.000Z"),
      at("c", 9000, "2026-03-03T00:00:00.000Z"),
      at("d", 20000, "2026-03-04T00:00:00.000Z"),
    ]
    expect(sortPayments(rows, "amount", "asc").map((p) => p.id)).toEqual([
      "b",
      "c",
      "d",
      "a",
    ])
  })

  it("puts a refund's negative amount below every positive one", () => {
    const rows = [
      at("a", 500, "2026-03-01T00:00:00.000Z"),
      at("b", -2500, "2026-03-02T00:00:00.000Z"),
    ]
    expect(sortPayments(rows, "amount", "asc").map((p) => p.id)).toEqual([
      "b",
      "a",
    ])
  })
})

describe("sortPayments by createdAt", () => {
  it("defaults to newest first", () => {
    const rows = [
      at("a", 500, "2026-03-01T00:00:00.000Z"),
      at("b", 500, "2026-03-09T00:00:00.000Z"),
    ]
    expect(sortPayments(rows).map((p) => p.id)).toEqual(["b", "a"])
  })
})

describe("sortPayments", () => {
  it("returns a new array rather than reordering the store's own", () => {
    const rows = [
      at("a", 9000, "2026-03-01T00:00:00.000Z"),
      at("b", 10000, "2026-03-02T00:00:00.000Z"),
    ]
    const sorted = sortPayments(rows, "amount", "desc")
    expect(sorted).not.toBe(rows)
    expect(rows.map((p) => p.id)).toEqual(["a", "b"])
  })
})
