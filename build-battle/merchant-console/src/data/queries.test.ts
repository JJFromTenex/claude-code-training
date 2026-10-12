import { describe, expect, it } from "vitest"
import { sortPayments } from "./queries"
import { Payment } from "./types"

const base: Payment = {
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

const payments: Payment[] = [
  { ...base, id: "pay_mid", amount: 25000 },
  { ...base, id: "pay_big", amount: 100000 },
  { ...base, id: "pay_small", amount: 2500 },
]

describe("sortPayments by amount", () => {
  it("orders minor units numerically, ascending", () => {
    expect(
      sortPayments(payments, "amount", "asc").map((p) => p.amount),
    ).toEqual([2500, 25000, 100000])
  })

  it("orders minor units numerically, descending", () => {
    expect(
      sortPayments(payments, "amount", "desc").map((p) => p.amount),
    ).toEqual([100000, 25000, 2500])
  })

  it("does not reorder the array it was given", () => {
    sortPayments(payments, "amount", "asc")
    expect(payments.map((p) => p.id)).toEqual(["pay_mid", "pay_big", "pay_small"])
  })
})
