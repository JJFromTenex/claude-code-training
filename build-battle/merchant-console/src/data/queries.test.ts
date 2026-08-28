import { describe, expect, it } from "vitest"
import { Payment } from "./types"
import { sortPayments } from "./queries"

/**
 * Amounts are integer minor units, so they sort numerically. Comparing them as
 * text puts 25000 ahead of 9500, which reads as a plausible order right up
 * until someone reconciles against it.
 */

function payment(id: string, amount: number): Payment {
  return {
    id,
    merchantId: "mch_01",
    amount,
    currency: "USD",
    status: "captured",
    method: "card",
    cardBrand: "visa",
    last4: "4242",
    createdAt: "2026-03-14T10:15:00.000Z",
    description: "Order",
  }
}

describe("sortPayments by amount", () => {
  const rows = [
    payment("pay_a", 25000),
    payment("pay_b", 9500),
    payment("pay_c", 100000),
    payment("pay_d", 999),
  ]

  it("orders ascending by value, not by digit string", () => {
    const sorted = sortPayments(rows, "amount", "asc").map((p) => p.amount)
    expect(sorted).toEqual([999, 9500, 25000, 100000])
  })

  it("orders descending by value", () => {
    const sorted = sortPayments(rows, "amount", "desc").map((p) => p.amount)
    expect(sorted).toEqual([100000, 25000, 9500, 999])
  })

  it("puts a smaller amount with more digits in its place", () => {
    // "9500" sorts after "25000" as text and before it as a number.
    const pair = sortPayments(
      [payment("pay_a", 25000), payment("pay_b", 9500)],
      "amount",
      "asc",
    )
    expect(pair[0].amount).toBe(9500)
  })

  it("leaves the input array untouched", () => {
    const original = [...rows]
    sortPayments(rows, "amount", "asc")
    expect(rows).toEqual(original)
  })
})

describe("sortPayments by date", () => {
  it("still orders newest first by default", () => {
    const older = { ...payment("pay_old", 100), createdAt: "2026-01-01T00:00:00.000Z" }
    const newer = { ...payment("pay_new", 100), createdAt: "2026-06-01T00:00:00.000Z" }
    expect(sortPayments([older, newer]).map((p) => p.id)).toEqual([
      "pay_new",
      "pay_old",
    ])
  })
})
