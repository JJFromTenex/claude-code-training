import { describe, expect, it } from "vitest"
import { sortPayments } from "./queries"
import { Payment } from "./types"

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
    description: "test",
  }
}

/**
 * Amounts are integer minor units. A string comparison ranks "994" above
 * "9992" and "9000" above "10000", which is exactly what the payments table
 * did for months. These cases fail on that comparator.
 */
describe("sortPayments by amount", () => {
  const rows = [
    payment("a", 9000, "2026-08-01T00:00:00.000Z"),
    payment("b", 10000, "2026-08-02T00:00:00.000Z"),
    payment("c", 994, "2026-08-03T00:00:00.000Z"),
    payment("d", 9999, "2026-08-04T00:00:00.000Z"),
    payment("e", 100_000, "2026-08-05T00:00:00.000Z"),
  ]

  it("orders descending by numeric value, not by digits", () => {
    expect(sortPayments(rows, "amount", "desc").map((p) => p.amount)).toEqual([
      100_000, 10000, 9999, 9000, 994,
    ])
  })

  it("orders ascending by numeric value", () => {
    expect(sortPayments(rows, "amount", "asc").map((p) => p.amount)).toEqual([
      994, 9000, 9999, 10000, 100_000,
    ])
  })

  it("does not mutate the input", () => {
    const before = rows.map((p) => p.id)
    sortPayments(rows, "amount", "desc")
    expect(rows.map((p) => p.id)).toEqual(before)
  })
})

describe("sortPayments by createdAt", () => {
  it("still sorts newest first by default", () => {
    const rows = [
      payment("old", 1, "2026-01-01T00:00:00.000Z"),
      payment("new", 1, "2026-02-01T00:00:00.000Z"),
    ]
    expect(sortPayments(rows).map((p) => p.id)).toEqual(["new", "old"])
  })
})
