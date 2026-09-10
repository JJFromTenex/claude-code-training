import { describe, expect, it } from "vitest"
import { sortPayments } from "./queries"
import { Payment } from "@/data/types"

/**
 * sortPayments has to order amounts numerically because amounts are integer
 * minor units, not formatted text. These fixtures are chosen so that text
 * order and numeric order disagree ("1000" sorts before "900" as text, but
 * 900 is the smaller amount), so a regression back to string comparison
 * fails loudly.
 */

function payment(overrides: Partial<Payment>): Payment {
  return {
    id: "pay_00000000",
    merchantId: "mch_01",
    amount: 1000,
    currency: "USD",
    status: "captured",
    method: "card",
    cardBrand: "visa",
    last4: "4242",
    createdAt: "2024-01-01T00:00:00.000Z",
    description: "Test payment",
    ...overrides,
  }
}

const payments: Payment[] = [
  payment({ id: "pay_a", amount: 900, createdAt: "2024-01-01T00:00:00.000Z" }),
  payment({ id: "pay_b", amount: 1000, createdAt: "2024-01-02T00:00:00.000Z" }),
  payment({ id: "pay_c", amount: 25000, createdAt: "2024-01-03T00:00:00.000Z" }),
  payment({ id: "pay_d", amount: 9999, createdAt: "2024-01-04T00:00:00.000Z" }),
]

describe("sortPayments", () => {
  it("orders amounts numerically ascending, not as text", () => {
    const sorted = sortPayments(payments, "amount", "asc")
    expect(sorted.map((p) => p.amount)).toEqual([900, 1000, 9999, 25000])
  })

  it("orders amounts numerically descending, not as text", () => {
    const sorted = sortPayments(payments, "amount", "desc")
    expect(sorted.map((p) => p.amount)).toEqual([25000, 9999, 1000, 900])
  })

  it("still sorts by createdAt ascending and descending", () => {
    const asc = sortPayments(payments, "createdAt", "asc")
    expect(asc.map((p) => p.id)).toEqual(["pay_a", "pay_b", "pay_c", "pay_d"])

    const desc = sortPayments(payments, "createdAt", "desc")
    expect(desc.map((p) => p.id)).toEqual(["pay_d", "pay_c", "pay_b", "pay_a"])
  })
})
