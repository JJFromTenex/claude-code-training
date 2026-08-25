import { describe, expect, it } from "vitest"
import { sortPayments } from "./queries"
import { Payment } from "./types"

/**
 * Sorting is the one place a payment amount is compared rather than formatted,
 * so it is the one place the minor-units rule can be broken without anything
 * looking wrong on screen.
 */

function payment(id: string, amount: number, createdAt: string): Payment {
  return {
    id,
    merchantId: "mch_01",
    amount,
    currency: "USD",
    status: "captured",
    method: "card",
    cardBrand: "visa",
    last4: "4242",
    createdAt,
    description: "Online order",
  }
}

describe("sortPayments", () => {
  it("orders amounts numerically, not as text", () => {
    // 9873 sorts before 994 as text, which is how this went unnoticed: both
    // orderings look plausible until the numbers have different digit counts.
    const rows = [
      payment("pay_1", 994, "2026-08-01T00:00:00.000Z"),
      payment("pay_2", 9873, "2026-08-02T00:00:00.000Z"),
      payment("pay_3", 10500, "2026-08-03T00:00:00.000Z"),
    ]

    expect(sortPayments(rows, "amount", "asc").map((p) => p.amount)).toEqual([
      994, 9873, 10500,
    ])
    expect(sortPayments(rows, "amount", "desc").map((p) => p.amount)).toEqual([
      10500, 9873, 994,
    ])
  })

  it("orders timestamps chronologically", () => {
    const rows = [
      payment("pay_1", 100, "2026-08-03T00:00:00.000Z"),
      payment("pay_2", 100, "2026-08-01T00:00:00.000Z"),
    ]

    expect(sortPayments(rows, "createdAt", "asc").map((p) => p.id)).toEqual([
      "pay_2",
      "pay_1",
    ])
  })

  it("leaves the caller's array alone", () => {
    const rows = [
      payment("pay_1", 100, "2026-08-01T00:00:00.000Z"),
      payment("pay_2", 200, "2026-08-02T00:00:00.000Z"),
    ]
    sortPayments(rows, "amount", "desc")

    expect(rows.map((p) => p.id)).toEqual(["pay_1", "pay_2"])
  })
})
