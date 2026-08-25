import { describe, expect, it } from "vitest"
import { sortPayments } from "./queries"
import { Payment } from "./types"

/**
 * sortPayments by "amount" compared amounts as strings, so ordering was
 * lexicographic instead of numeric: "9999" sorted above "150000" because
 * "9" > "1" as the first character, even though 150000 is the larger
 * amount. Amounts are integer minor units (see .claude/rules/money.md) and
 * must be compared numerically.
 */

function payment(id: string, amount: number): Payment {
  return {
    id,
    merchantId: "merch_1",
    amount,
    currency: "USD",
    status: "captured",
    method: "card",
    cardBrand: "visa",
    last4: "4242",
    createdAt: "2024-01-01T00:00:00.000Z",
    description: "test payment",
  }
}

describe("sortPayments", () => {
  it("orders by amount descending numerically, not lexicographically", () => {
    const payments = [
      payment("pay_994", 994),
      payment("pay_150000", 150000),
      payment("pay_9999", 9999),
      payment("pay_25000", 25000),
    ]

    const sorted = sortPayments(payments, "amount", "desc")

    expect(sorted.map((p) => p.id)).toEqual([
      "pay_150000",
      "pay_25000",
      "pay_9999",
      "pay_994",
    ])
  })

  it("orders by amount ascending numerically", () => {
    const payments = [
      payment("pay_9999", 9999),
      payment("pay_994", 994),
      payment("pay_150000", 150000),
    ]

    const sorted = sortPayments(payments, "amount", "asc")

    expect(sorted.map((p) => p.id)).toEqual([
      "pay_994",
      "pay_9999",
      "pay_150000",
    ])
  })
})
