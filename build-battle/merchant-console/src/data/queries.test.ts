import { describe, expect, it } from "vitest"
import { Payment } from "./types"
import { sortPayments } from "./queries"

/**
 * sortPayments used to compare amounts as text (String(a.amount).localeCompare),
 * so 9000 sorted after 10000 — a bug found while building NWP-101, in the
 * exact query builder that ticket reuses. This pins the numeric fix.
 */

const base: Payment = {
  id: "pay_0001",
  merchantId: "mch_01",
  amount: 0,
  currency: "USD",
  status: "captured",
  method: "card",
  cardBrand: "visa",
  last4: "4242",
  createdAt: "2026-03-14T10:15:00.000Z",
  description: "Order 1180",
}

describe("sortPayments", () => {
  it("sorts amounts numerically, not as text", () => {
    const payments = [
      { ...base, id: "pay_a", amount: 10000 },
      { ...base, id: "pay_b", amount: 9000 },
      { ...base, id: "pay_c", amount: 500 },
    ]
    const sorted = sortPayments(payments, "amount", "asc")
    expect(sorted.map((p) => p.id)).toEqual(["pay_c", "pay_b", "pay_a"])
  })

  it("respects direction for numeric amounts", () => {
    const payments = [
      { ...base, id: "pay_a", amount: 500 },
      { ...base, id: "pay_b", amount: 10000 },
    ]
    const sorted = sortPayments(payments, "amount", "desc")
    expect(sorted.map((p) => p.id)).toEqual(["pay_b", "pay_a"])
  })
})
