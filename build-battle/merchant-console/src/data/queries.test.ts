import { describe, expect, it } from "vitest"
import { sortPayments } from "./queries"
import { Payment } from "./types"

/**
 * Amounts are integer minor units, so they sort as numbers. Sorting them as
 * text puts 900 after 10000, which looks plausible in a table and is wrong.
 */

function payment(id: string, amount: number, createdAt: string): Payment {
  return {
    id,
    merchantId: "mch_test",
    amount,
    currency: "USD",
    status: "captured",
    method: "card",
    cardBrand: "visa",
    last4: "4242",
    createdAt,
    description: "Test payment",
  }
}

const payments: Payment[] = [
  payment("pay_1", 900, "2026-03-14T10:00:00.000Z"),
  payment("pay_2", 10000, "2026-03-12T10:00:00.000Z"),
  payment("pay_3", 2500, "2026-03-15T10:00:00.000Z"),
  payment("pay_4", 100000, "2026-03-13T10:00:00.000Z"),
]

describe("sortPayments", () => {
  it("orders amounts numerically ascending", () => {
    expect(sortPayments(payments, "amount", "asc").map((p) => p.amount)).toEqual(
      [900, 2500, 10000, 100000],
    )
  })

  it("orders amounts numerically descending", () => {
    expect(
      sortPayments(payments, "amount", "desc").map((p) => p.amount),
    ).toEqual([100000, 10000, 2500, 900])
  })

  it("still sorts by createdAt in both directions", () => {
    expect(
      sortPayments(payments, "createdAt", "asc").map((p) => p.id),
    ).toEqual(["pay_2", "pay_4", "pay_1", "pay_3"])
    expect(
      sortPayments(payments, "createdAt", "desc").map((p) => p.id),
    ).toEqual(["pay_3", "pay_1", "pay_4", "pay_2"])
  })

  it("does not mutate the input array", () => {
    const before = payments.map((p) => p.id)
    sortPayments(payments, "amount", "asc")
    expect(payments.map((p) => p.id)).toEqual(before)
  })
})
