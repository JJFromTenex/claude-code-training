import { describe, expect, it } from "vitest"
import { Payment } from "./types"
import { sortPayments } from "./queries"

/**
 * The amount sort fed the CSV export as well as the table, and it compared
 * amounts as strings — so 500 sorted after 123456789. These pin the numeric
 * order so the export cannot regress to lexicographic.
 */

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

const withAmounts = (amounts: number[]): Payment[] =>
  amounts.map((amount, index) => ({
    ...base,
    id: `pay_${index}`,
    amount,
  }))

describe("sortPayments by amount", () => {
  it("orders by numeric value, not by digit string", () => {
    const rows = sortPayments(
      withAmounts([9000, 25000, 123456789, 500]),
      "amount",
      "asc",
    )
    expect(rows.map((row) => row.amount)).toEqual([
      500, 9000, 25000, 123456789,
    ])
  })

  it("reverses cleanly for descending", () => {
    const rows = sortPayments(
      withAmounts([9000, 25000, 123456789, 500]),
      "amount",
      "desc",
    )
    expect(rows.map((row) => row.amount)).toEqual([
      123456789, 25000, 9000, 500,
    ])
  })

  it("does not mutate the array it was given", () => {
    const input = withAmounts([300, 100, 200])
    sortPayments(input, "amount", "asc")
    expect(input.map((row) => row.amount)).toEqual([300, 100, 200])
  })
})
