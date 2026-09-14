import { describe, expect, it } from "vitest"
import { Payment } from "./types"
import { sortPayments } from "./queries"

/**
 * Sorting is what decides the order of the payments table and of the CSV the
 * export writes, so getting it wrong is visible to ops and to merchants.
 * Amounts are integer minor units and must be compared as numbers: comparing
 * them as text put £9.00 above £100.00.
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

const payment = (id: string, fields: Partial<Payment>): Payment => ({
  ...base,
  id,
  ...fields,
})

describe("sortPayments by amount", () => {
  // 900 minor units sorts above 10000 when compared as text.
  const amounts = [
    payment("pay_small", { amount: 900 }),
    payment("pay_large", { amount: 10000 }),
    payment("pay_mid", { amount: 2500 }),
  ]

  it("orders by value, not by the text of the number", () => {
    const ids = sortPayments(amounts, "amount", "asc").map((p) => p.id)
    expect(ids).toEqual(["pay_small", "pay_mid", "pay_large"])
  })

  it("puts the largest amount first when descending", () => {
    const ids = sortPayments(amounts, "amount", "desc").map((p) => p.id)
    expect(ids).toEqual(["pay_large", "pay_mid", "pay_small"])
  })

  it("keeps a refund below every capture rather than beside the zeroes", () => {
    const withRefund = [...amounts, payment("pay_refund", { amount: -5000 })]
    const ids = sortPayments(withRefund, "amount", "asc").map((p) => p.id)
    expect(ids[0]).toBe("pay_refund")
  })

  it("does not mutate the array it was given", () => {
    const original = [...amounts]
    sortPayments(amounts, "amount", "asc")
    expect(amounts).toEqual(original)
  })
})

describe("sortPayments by createdAt", () => {
  const dates = [
    payment("pay_mar", { createdAt: "2026-03-14T10:15:00.000Z" }),
    payment("pay_jan", { createdAt: "2026-01-02T10:15:00.000Z" }),
    payment("pay_feb", { createdAt: "2026-02-20T10:15:00.000Z" }),
  ]

  it("defaults to newest first", () => {
    const ids = sortPayments(dates).map((p) => p.id)
    expect(ids).toEqual(["pay_mar", "pay_feb", "pay_jan"])
  })

  it("orders oldest first when ascending", () => {
    const ids = sortPayments(dates, "createdAt", "asc").map((p) => p.id)
    expect(ids).toEqual(["pay_jan", "pay_feb", "pay_mar"])
  })
})
