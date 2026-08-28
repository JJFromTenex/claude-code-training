import { describe, expect, it } from "vitest"
import { Payment } from "./types"
import { sortPayments } from "./queries"

/**
 * Sorting is the last thing between the store and what ops reads, so an
 * ordering bug looks like missing data rather than a wrong sort. Amounts are
 * minor units and must be compared as numbers: as strings, "900" lands after
 * "10000" and the largest payments hide in the middle of an ascending list.
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

/** Minor units chosen so a string compare and a number compare disagree. */
const amounts = [
  { ...payment, id: "pay_a", amount: 99 },
  { ...payment, id: "pay_b", amount: 10000 },
  { ...payment, id: "pay_c", amount: 900 },
  { ...payment, id: "pay_d", amount: 2500 },
]

describe("sortPayments", () => {
  it("orders amounts by value ascending, not by their digits", () => {
    const sorted = sortPayments(amounts, "amount", "asc")
    expect(sorted.map((p) => p.amount)).toEqual([99, 900, 2500, 10000])
  })

  it("orders amounts by value descending", () => {
    const sorted = sortPayments(amounts, "amount", "desc")
    expect(sorted.map((p) => p.amount)).toEqual([10000, 2500, 900, 99])
  })

  it("puts the largest amount first, so a descending list opens with it", () => {
    const [top] = sortPayments(amounts, "amount", "desc")
    expect(top.amount).toBe(Math.max(...amounts.map((p) => p.amount)))
  })

  it("orders by created date, newest first by default", () => {
    const dates = [
      { ...payment, id: "pay_old", createdAt: "2026-03-01T00:00:00.000Z" },
      { ...payment, id: "pay_new", createdAt: "2026-03-20T00:00:00.000Z" },
    ]
    expect(sortPayments(dates).map((p) => p.id)).toEqual(["pay_new", "pay_old"])
  })

  it("leaves the caller's array alone", () => {
    const before = amounts.map((p) => p.amount)
    sortPayments(amounts, "amount", "asc")
    expect(amounts.map((p) => p.amount)).toEqual(before)
  })
})
