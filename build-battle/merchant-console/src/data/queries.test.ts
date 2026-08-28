import { describe, expect, it } from "vitest"
import { sortPayments } from "./queries"
import { Payment } from "./types"

/**
 * Sorting by amount compared the digits as text, so 9999 ranked above 10000
 * and "largest payments first" returned the ones with the most nines. These
 * tests pin numeric order; the first one fails on the old comparator.
 */

const base: Payment = {
  id: "pay_0000",
  merchantId: "mch_01",
  amount: 0,
  currency: "USD",
  status: "captured",
  method: "card",
  cardBrand: "visa",
  last4: "4242",
  createdAt: "2026-03-14T10:15:00.000Z",
  description: "Order 1180",
}

const withAmount = (id: string, amount: number): Payment => ({
  ...base,
  id,
  amount,
})

describe("sortPayments by amount", () => {
  const rows = [
    withAmount("pay_a", 9999),
    withAmount("pay_b", 10000),
    withAmount("pay_c", 994),
    withAmount("pay_d", 123456),
  ]

  it("orders by the number, not by the digits", () => {
    expect(sortPayments(rows, "amount", "desc").map((p) => p.amount)).toEqual([
      123456, 10000, 9999, 994,
    ])
    expect(sortPayments(rows, "amount", "asc").map((p) => p.amount)).toEqual([
      994, 9999, 10000, 123456,
    ])
  })

  it("keeps a single-digit amount below a two-digit one", () => {
    const small = [withAmount("pay_e", 9), withAmount("pay_f", 10)]
    expect(sortPayments(small, "amount", "desc").map((p) => p.id)).toEqual([
      "pay_f",
      "pay_e",
    ])
  })

  it("returns a new array and leaves the input alone", () => {
    const before = rows.map((p) => p.id)
    sortPayments(rows, "amount", "desc")
    expect(rows.map((p) => p.id)).toEqual(before)
  })
})

describe("sortPayments by date", () => {
  it("still orders newest first by default", () => {
    const rows = [
      { ...base, id: "pay_old", createdAt: "2026-03-01T00:00:00.000Z" },
      { ...base, id: "pay_new", createdAt: "2026-03-14T00:00:00.000Z" },
    ]
    expect(sortPayments(rows).map((p) => p.id)).toEqual(["pay_new", "pay_old"])
  })
})
