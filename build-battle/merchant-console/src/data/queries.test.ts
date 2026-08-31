import { describe, expect, it } from "vitest"
import { Payment } from "./types"
import { sortPayments } from "./queries"

/**
 * Amounts are integer minor units, and the sort has to compare them as
 * numbers. A string comparator ranks by leading digit, not magnitude, so a
 * short number with a high leading digit (999) outranks a longer number
 * with a low one (25000) — the exact case pinned here.
 */

function makePayment(id: string, amount: number): Payment {
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

describe("sortPayments", () => {
  it("orders by numeric amount, descending, not by leading digit", () => {
    const payments = [
      makePayment("pay_small", 999), // $9.99
      makePayment("pay_large", 25000), // $250.00
      makePayment("pay_mid", 5000), // $50.00
    ]

    const sorted = sortPayments(payments, "amount", "desc")

    expect(sorted.map((p) => p.id)).toEqual(["pay_large", "pay_mid", "pay_small"])
  })

  it("orders by numeric amount, ascending, not by leading digit", () => {
    const payments = [
      makePayment("pay_large", 25000), // $250.00
      makePayment("pay_small", 999), // $9.99
      makePayment("pay_mid", 5000), // $50.00
    ]

    const sorted = sortPayments(payments, "amount", "asc")

    expect(sorted.map((p) => p.id)).toEqual(["pay_small", "pay_mid", "pay_large"])
  })
})
