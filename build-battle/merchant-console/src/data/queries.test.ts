import { describe, expect, it } from "vitest"
import { Payment } from "@/data/types"
import {
  filterPayments,
  parseFilters,
  sortPayments,
  summarizePayments,
} from "./queries"

/**
 * The query builder is what ops now slices the console with, so a wrong
 * predicate here is a wrong number on screen rather than a stack trace. These
 * tests pin the allowlists, the two linked slicers, the numeric amount sort,
 * and the rule that money is never summed across currencies.
 *
 * Seed data is deterministic (a fixed-seed PRNG in generate.ts), so the
 * store-backed assertions below are stable across machines and runs.
 */

const payment: Payment = {
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

const params = (query: string) => new URLSearchParams(query)

describe("parseFilters", () => {
  it("allowlists the payment method and falls back to all", () => {
    expect(parseFilters(params("method=wallet")).method).toBe("wallet")
    expect(parseFilters(params("method=cheque")).method).toBe("all")
  })

  it("keeps a card brand only when the method is card", () => {
    expect(parseFilters(params("method=card&cardBrand=amex")).cardBrand).toBe(
      "amex",
    )
    expect(parseFilters(params("method=wallet&cardBrand=amex")).cardBrand).toBe(
      "all",
    )
  })

  it("drops a card brand that is not a brand we issue", () => {
    expect(parseFilters(params("method=card&cardBrand=discover")).cardBrand).toBe(
      "all",
    )
  })

  it("allowlists the currency and leaves it unset when unknown", () => {
    expect(parseFilters(params("currency=EUR")).currency).toBe("EUR")
    expect(parseFilters(params("currency=JPY")).currency).toBeUndefined()
  })

  it("converts amount bounds to minor units once, at the boundary", () => {
    const filters = parseFilters(params("currency=USD&minAmount=250.00&maxAmount=500"))
    expect(filters.minAmount).toBe(25000)
    expect(filters.maxAmount).toBe(50000)
  })

  it("drops amount bounds when no currency gates them, since the comparison would be meaningless", () => {
    const filters = parseFilters(params("minAmount=250.00&maxAmount=500"))
    expect(filters.minAmount).toBeUndefined()
    expect(filters.maxAmount).toBeUndefined()
  })

  it("drops an unparseable amount rather than coercing it to zero", () => {
    const filters = parseFilters(params("currency=USD&minAmount=abc"))
    expect(filters.minAmount).toBeUndefined()
  })

  it("allowlists the sort key and falls back to the date", () => {
    expect(parseFilters(params("sort=merchant")).sort).toBe("merchant")
    expect(parseFilters(params("sort=last4")).sort).toBe("createdAt")
  })
})

describe("sortPayments", () => {
  it("orders amounts numerically, so 9 does not sort above 100", () => {
    const rows = [
      { ...payment, id: "pay_a", amount: 100 },
      { ...payment, id: "pay_b", amount: 9 },
      { ...payment, id: "pay_c", amount: 20 },
    ]
    expect(sortPayments(rows, "amount", "asc").map((p) => p.amount)).toEqual([
      9, 20, 100,
    ])
  })

  it("reverses the amount order on descending", () => {
    const rows = [
      { ...payment, amount: 100 },
      { ...payment, amount: 9 },
      { ...payment, amount: 20 },
    ]
    expect(sortPayments(rows, "amount", "desc").map((p) => p.amount)).toEqual([
      100, 20, 9,
    ])
  })

  it("orders by merchant name rather than merchant id", () => {
    // mch_09 is Aster Botanicals and mch_01 is Lumen Coffee Roasters, so
    // sorting by name reverses their id order.
    const rows = [
      { ...payment, merchantId: "mch_01" },
      { ...payment, merchantId: "mch_09" },
    ]
    expect(
      sortPayments(rows, "merchant", "asc").map((p) => p.merchantId),
    ).toEqual(["mch_09", "mch_01"])
  })

  it("orders by status", () => {
    const rows = [
      { ...payment, status: "refunded" as const },
      { ...payment, status: "authorized" as const },
    ]
    expect(sortPayments(rows, "status", "asc").map((p) => p.status)).toEqual([
      "authorized",
      "refunded",
    ])
  })

  it("leaves the caller's array untouched", () => {
    const rows = [
      { ...payment, amount: 100 },
      { ...payment, amount: 9 },
    ]
    sortPayments(rows, "amount", "asc")
    expect(rows.map((p) => p.amount)).toEqual([100, 9])
  })
})

describe("summarizePayments", () => {
  it("counts the rows it was given", () => {
    expect(summarizePayments([payment, payment, payment]).count).toBe(3)
  })

  it("keeps each currency on its own line rather than summing across them", () => {
    const rows = [
      { ...payment, currency: "USD" as const, amount: 25000 },
      { ...payment, currency: "EUR" as const, amount: 10000 },
      { ...payment, currency: "USD" as const, amount: 5000 },
    ]
    expect(summarizePayments(rows).totals).toEqual([
      { currency: "USD", amount: 30000 },
      { currency: "EUR", amount: 10000 },
    ])
  })

  it("reports no totals for an empty set, so the strip renders zero rather than blank", () => {
    expect(summarizePayments([])).toEqual({ count: 0, totals: [] })
  })
})

describe("filterPayments", () => {
  it("returns only payments made with the chosen method", () => {
    const rows = filterPayments({ method: "wallet" })
    expect(rows.length).toBeGreaterThan(0)
    expect(rows.every((p) => p.method === "wallet")).toBe(true)
  })

  it("narrows to a single card brand within card payments", () => {
    const rows = filterPayments({ method: "card", cardBrand: "amex" })
    expect(rows.length).toBeGreaterThan(0)
    expect(rows.every((p) => p.method === "card" && p.cardBrand === "amex")).toBe(
      true,
    )
  })

  it("returns only payments in the chosen currency", () => {
    const rows = filterPayments({ currency: "GBP" })
    expect(rows.length).toBeGreaterThan(0)
    expect(rows.every((p) => p.currency === "GBP")).toBe(true)
  })

  it("bounds amounts by the range, in minor units and inclusive", () => {
    const rows = filterPayments({
      currency: "USD",
      minAmount: 10000,
      maxAmount: 20000,
    })
    expect(rows.length).toBeGreaterThan(0)
    expect(rows.every((p) => p.amount >= 10000 && p.amount <= 20000)).toBe(true)
  })

  it("returns nothing when the range excludes every payment", () => {
    expect(filterPayments({ currency: "USD", minAmount: 900_000_00 })).toEqual([])
  })

  it("narrows further as slicers combine", () => {
    const byCurrency = filterPayments({ currency: "USD" })
    const byCurrencyAndMethod = filterPayments({
      currency: "USD",
      method: "card",
    })
    expect(byCurrencyAndMethod.length).toBeGreaterThan(0)
    expect(byCurrencyAndMethod.length).toBeLessThan(byCurrency.length)
  })
})
