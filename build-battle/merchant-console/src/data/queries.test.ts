import { describe, expect, it } from "vitest"
import { sortPayments } from "./queries"
import { Payment } from "./types"

const payment = (id: string, amount: number): Payment => ({
  id,
  merchantId: "mch_01",
  amount,
  currency: "USD",
  status: "captured",
  method: "card",
  cardBrand: "visa",
  last4: "4242",
  createdAt: "2026-08-01T00:00:00.000Z",
  description: "test",
})

describe("sortPayments", () => {
  it("sorts amounts numerically, not lexically", () => {
    // Lexical order would put 900 after 10000 ("9" > "1").
    const rows = [payment("a", 10000), payment("b", 900), payment("c", 2500)]
    expect(sortPayments(rows, "amount", "asc").map((p) => p.amount)).toEqual([
      900, 2500, 10000,
    ])
    expect(sortPayments(rows, "amount", "desc").map((p) => p.amount)).toEqual([
      10000, 2500, 900,
    ])
  })
})
