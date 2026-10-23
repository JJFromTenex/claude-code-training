import { describe, expect, it } from "vitest"
import { sortPayments } from "./queries"
import { Payment } from "./types"

/**
 * Amounts are integer minor units, so sorting by amount must compare numbers.
 * Compared as text, 999 ($9.99) ranks above 10000 ($100.00) because "9" > "1",
 * which is exactly the order ops saw when looking for the largest payments.
 */

const at = (id: string, amount: number): Payment => ({
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
})

const payments = [at("small", 999), at("large", 10000), at("medium", 2500), at("tiny", 5)]

describe("sortPayments by amount", () => {
  it("puts the largest payment first when descending, by value not by digits", () => {
    expect(sortPayments(payments, "amount", "desc").map((p) => p.id)).toEqual([
      "large",
      "medium",
      "small",
      "tiny",
    ])
  })

  it("puts the smallest payment first when ascending", () => {
    expect(sortPayments(payments, "amount", "asc").map((p) => p.id)).toEqual([
      "tiny",
      "small",
      "medium",
      "large",
    ])
  })

  it("does not reorder the caller's array", () => {
    const input = [...payments]
    sortPayments(input, "amount", "desc")
    expect(input.map((p) => p.id)).toEqual(payments.map((p) => p.id))
  })
})
