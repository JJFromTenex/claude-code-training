import { describe, expect, it } from "vitest"
import { Payment } from "./types"
import { sortPayments } from "./queries"

/** Minor units are integers, and integers compared as text sort wrong. */

const at = (amount: number, id: string): Payment => ({
  id,
  merchantId: "mch_01",
  amount,
  currency: "USD",
  status: "captured",
  method: "card",
  cardBrand: "visa",
  last4: "4242",
  createdAt: "2026-08-13T12:00:00.000Z",
  description: "Online order",
})

describe("sortPayments", () => {
  const rows = [at(900, "a"), at(10000, "b"), at(200, "c"), at(1000, "d")]

  it("orders amounts numerically, ascending", () => {
    // As text this is 1000, 10000, 200, 900.
    expect(sortPayments(rows, "amount", "asc").map((p) => p.amount)).toEqual([
      200, 900, 1000, 10000,
    ])
  })

  it("orders amounts numerically, descending", () => {
    expect(sortPayments(rows, "amount", "desc").map((p) => p.amount)).toEqual([
      10000, 1000, 900, 200,
    ])
  })
})
