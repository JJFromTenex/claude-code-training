import { describe, expect, it } from "vitest"
import { sortPayments } from "./queries"
import { Payment } from "./types"

/**
 * Amounts are integer minor units, so sorting them as text puts $9.00 after
 * $10.00 -- the shorter string wins on the first differing character. Ops
 * sorts by amount to find the largest payments, which is exactly the case
 * that was wrong.
 */

const base: Payment = {
  id: "pay_0001",
  merchantId: "mch_01",
  amount: 900,
  currency: "USD",
  status: "captured",
  method: "card",
  cardBrand: "visa",
  last4: "4242",
  createdAt: "2026-03-14T10:15:00.000Z",
  description: "Order 1180",
}

const payments: Payment[] = [
  { ...base, id: "pay_a", amount: 900 },
  { ...base, id: "pay_b", amount: 100000 },
  { ...base, id: "pay_c", amount: 10000 },
]

describe("sortPayments", () => {
  it("orders amounts by value, not as text", () => {
    const ascending = sortPayments(payments, "amount", "asc")
    expect(ascending.map((p) => p.amount)).toEqual([900, 10000, 100000])
  })

  it("orders amounts descending for the largest first", () => {
    const descending = sortPayments(payments, "amount", "desc")
    expect(descending.map((p) => p.amount)).toEqual([100000, 10000, 900])
  })

  it("still orders by createdAt, newest first, by default", () => {
    const dated = [
      { ...base, id: "pay_old", createdAt: "2026-01-01T00:00:00.000Z" },
      { ...base, id: "pay_new", createdAt: "2026-06-01T00:00:00.000Z" },
    ]
    expect(sortPayments(dated).map((p) => p.id)).toEqual(["pay_new", "pay_old"])
  })
})
