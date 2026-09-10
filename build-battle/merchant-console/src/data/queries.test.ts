import { describe, expect, it } from "vitest"
import { sortPayments } from "./queries"
import { Payment } from "./types"

const payment = (id: string, amount: number, createdAt: string): Payment => ({
  id,
  merchantId: "mch_01",
  amount,
  currency: "USD",
  status: "captured",
  method: "card",
  cardBrand: "visa",
  last4: "4242",
  createdAt,
  description: "Test payment",
})

const rows = [
  payment("pay_a", 900, "2026-08-01T00:00:00.000Z"),
  payment("pay_b", 10000, "2026-08-02T00:00:00.000Z"),
  payment("pay_c", 25000, "2026-08-03T00:00:00.000Z"),
]

describe("sortPayments by amount", () => {
  it("orders by numeric value, not by the digits as text", () => {
    // As text, "10000" < "25000" < "900", which puts $9.00 above $250.00.
    expect(sortPayments(rows, "amount", "asc").map((p) => p.amount)).toEqual([
      900, 10000, 25000,
    ])
    expect(sortPayments(rows, "amount", "desc").map((p) => p.amount)).toEqual([
      25000, 10000, 900,
    ])
  })

  it("still sorts by date when asked", () => {
    expect(sortPayments(rows, "createdAt", "desc").map((p) => p.id)).toEqual([
      "pay_c",
      "pay_b",
      "pay_a",
    ])
  })
})
