import { describe, expect, it } from "vitest"
import { Payment } from "./types"
import { sortPayments } from "./queries"

/**
 * Sorting by amount used to compare the digits rather than the money, so a
 * $99 payment outranked a $1,234 one. The export inherits this order, which
 * is how a wrong sort reaches a merchant's inbox.
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

const withAmount = (id: string, amount: number): Payment => ({
  ...payment,
  id,
  amount,
})

describe("sortPayments", () => {
  it("orders by amount as money, not as digits, so 9900 sits below 123456", () => {
    const rows = [
      withAmount("pay_small", 9900),
      withAmount("pay_large", 123456),
    ]
    expect(sortPayments(rows, "amount", "asc").map((p) => p.id)).toEqual([
      "pay_small",
      "pay_large",
    ])
  })

  it("reverses cleanly, so the largest amount leads a descending sort", () => {
    const rows = [
      withAmount("pay_mid", 50000),
      withAmount("pay_large", 123456),
      withAmount("pay_small", 9900),
    ]
    expect(sortPayments(rows, "amount", "desc").map((p) => p.id)).toEqual([
      "pay_large",
      "pay_mid",
      "pay_small",
    ])
  })

  it("leaves the caller's array alone, because the store is shared", () => {
    const rows = [withAmount("pay_a", 200), withAmount("pay_b", 100)]
    sortPayments(rows, "amount", "asc")
    expect(rows.map((p) => p.id)).toEqual(["pay_a", "pay_b"])
  })
})
