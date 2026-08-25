import { describe, expect, it } from "vitest"
import { sortPayments } from "./queries"
import { Payment } from "./types"

/**
 * Regression test for the amount sort.
 *
 * `sortPayments` compared amounts with `String(a.amount).localeCompare(...)`,
 * which orders lexicographically: "1000" sorts before "900" because "1" < "9".
 * The payments table sorted by amount was therefore wrong for any set whose
 * amounts differed in digit count, which is most of them.
 */

const payment = (id: string, amount: number): Payment => ({
  id,
  merchantId: "mch_01",
  amount,
  currency: "USD",
  status: "captured",
  method: "card",
  cardBrand: "visa",
  last4: "4242",
  createdAt: "2026-08-01T00:00:00.000Z",
  description: "Test",
})

describe("sortPayments by amount", () => {
  const rows = [
    payment("pay_900", 900),
    payment("pay_1000", 1000),
    payment("pay_85", 85),
    payment("pay_120000", 120_000),
  ]

  it("orders ascending by numeric value, not by digit string", () => {
    const sorted = sortPayments(rows, "amount", "asc").map((p) => p.amount)
    expect(sorted).toEqual([85, 900, 1000, 120_000])
  })

  it("orders descending by numeric value", () => {
    const sorted = sortPayments(rows, "amount", "desc").map((p) => p.amount)
    expect(sorted).toEqual([120_000, 1000, 900, 85])
  })

  it("does not mutate the array it was given", () => {
    const before = rows.map((p) => p.amount)
    sortPayments(rows, "amount", "asc")
    expect(rows.map((p) => p.amount)).toEqual(before)
  })
})

describe("sortPayments by createdAt", () => {
  it("still sorts newest first by default", () => {
    const rows = [
      { ...payment("a", 100), createdAt: "2026-01-01T00:00:00.000Z" },
      { ...payment("b", 100), createdAt: "2026-06-01T00:00:00.000Z" },
    ]
    expect(sortPayments(rows).map((p) => p.id)).toEqual(["b", "a"])
  })
})
