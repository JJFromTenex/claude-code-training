import { describe, expect, it } from "vitest"
import { parseFilters, sortPayments } from "./queries"
import { Payment } from "./types"

/**
 * Two pre-existing defects found while building NWP-201, pinned so they do
 * not come back: amount sort compared amounts as strings, and a fractional
 * page number reached `paginate` unvalidated.
 */

const payment = (id: string, amount: number): Payment => ({
  id,
  merchantId: "mch_01",
  amount,
  currency: "USD",
  status: "captured",
  method: "card",
  cardBrand: "visa",
  last4: "4242",
  createdAt: "2026-01-01T00:00:00.000Z",
  description: "test",
})

describe("sortPayments by amount", () => {
  it("orders numerically, not lexicographically", () => {
    // "9999" > "10000" as strings; the fix compares numbers.
    const rows = [payment("a", 9999), payment("b", 10000), payment("c", 450)]
    expect(sortPayments(rows, "amount", "asc").map((p) => p.id)).toEqual([
      "c",
      "a",
      "b",
    ])
    expect(sortPayments(rows, "amount", "desc").map((p) => p.id)).toEqual([
      "b",
      "a",
      "c",
    ])
  })
})

describe("parseFilters page", () => {
  it("falls back to page 1 for a fractional or non-positive page", () => {
    expect(parseFilters(new URLSearchParams("page=2.5")).page).toBe(1)
    expect(parseFilters(new URLSearchParams("page=0")).page).toBe(1)
    expect(parseFilters(new URLSearchParams("page=-3")).page).toBe(1)
    expect(parseFilters(new URLSearchParams("page=abc")).page).toBe(1)
  })

  it("accepts a valid positive integer page", () => {
    expect(parseFilters(new URLSearchParams("page=3")).page).toBe(3)
  })
})
