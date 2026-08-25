import { describe, expect, it } from "vitest"
import { sortPayments } from "./queries"
import type { Payment } from "./types"

function payment(id: string, amount: number): Payment {
  return {
    id,
    merchantId: "mch_01",
    amount,
    currency: "USD",
    status: "captured",
    method: "card",
    cardBrand: "visa",
    last4: "4242",
    createdAt: "2026-01-01T00:00:00.000Z",
    description: "Online order",
  }
}

describe("sortPayments", () => {
  it("orders amounts numerically, not lexicographically, descending", () => {
    // A string sort would put "994" ahead of "9873" because '9' > '8' at
    // the second character, even though 994 < 9873 numerically.
    const payments = [payment("a", 994), payment("b", 9873), payment("c", 9999)]

    const sorted = sortPayments(payments, "amount", "desc")

    expect(sorted.map((p) => p.amount)).toEqual([9999, 9873, 994])
  })

  it("orders amounts numerically ascending", () => {
    const payments = [payment("a", 9873), payment("b", 994), payment("c", 9999)]

    const sorted = sortPayments(payments, "amount", "asc")

    expect(sorted.map((p) => p.amount)).toEqual([994, 9873, 9999])
  })
})
