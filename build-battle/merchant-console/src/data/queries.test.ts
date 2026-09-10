import { Payment } from "@/data/types"
import { describe, expect, it } from "vitest"
import { sortPayments } from "./queries"

/**
 * Sorting sits on the export path as well as the table, so an order that is
 * wrong here is wrong in the file ops hands to a merchant. Amounts are integer
 * minor units; comparing them as text used to rank 900 above 1000.
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

const byAmount: Payment[] = [
  { ...payment, id: "pay_0900", amount: 900 },
  { ...payment, id: "pay_1000", amount: 1000 },
  { ...payment, id: "pay_0090", amount: 90 },
]

describe("sortPayments", () => {
  it("orders amounts by value, so 1000 outranks 900 rather than the reverse", () => {
    expect(
      sortPayments(byAmount, "amount", "asc").map((p) => p.amount),
    ).toEqual([90, 900, 1000])
    expect(
      sortPayments(byAmount, "amount", "desc").map((p) => p.amount),
    ).toEqual([1000, 900, 90])
  })

  it("sorts by date newest first when no sort is named", () => {
    const rows: Payment[] = [
      { ...payment, id: "pay_mar", createdAt: "2026-03-14T10:15:00.000Z" },
      { ...payment, id: "pay_may", createdAt: "2026-05-02T08:00:00.000Z" },
      { ...payment, id: "pay_jan", createdAt: "2026-01-09T22:45:00.000Z" },
    ]
    expect(sortPayments(rows).map((p) => p.id)).toEqual([
      "pay_may",
      "pay_mar",
      "pay_jan",
    ])
  })

  it("returns a new array, so the caller's list keeps its own order", () => {
    const original = [...byAmount]
    sortPayments(byAmount, "amount", "asc")
    expect(byAmount).toEqual(original)
  })
})
