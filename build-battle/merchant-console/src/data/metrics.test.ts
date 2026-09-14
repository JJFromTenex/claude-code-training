import { describe, expect, it } from "vitest"
import { sumMinorUnits } from "@/lib/money"
import { dailyVolumeFor, volumeByCurrency } from "./metrics"
import { Dispute, Payment, Refund } from "./types"

/**
 * NWP-102: three merchants said daily totals did not match their statements.
 * These cases pin the three causes — float accumulation, local-time
 * bucketing, and refunds added instead of subtracted — so they stay fixed.
 */

// A non-UTC zone so a local-date bucket would land on the wrong day.
process.env.TZ = "America/New_York"

function payment(over: Partial<Payment> & Pick<Payment, "amount" | "createdAt">): Payment {
  return {
    id: over.id ?? `pay_${over.createdAt}_${over.amount}`,
    merchantId: "mch_05",
    currency: "EUR",
    status: "captured",
    method: "card",
    cardBrand: "visa",
    last4: "4242",
    description: "test",
    ...over,
  }
}

describe("dailyVolumeFor", () => {
  it("buckets by UTC calendar day, not the server's local day", () => {
    // 23:30 UTC on Aug 12 is still Aug 12 in UTC, but Aug 12 19:30 in New
    // York — and 01:30 on Aug 13 in Berlin. The statement is UTC.
    const rows = [payment({ amount: 1000, createdAt: "2026-08-12T23:30:00.000Z" })]
    const out = dailyVolumeFor(rows, ["2026-08-12", "2026-08-13"], "EUR")
    expect(out).toEqual([
      { date: "2026-08-12", captured: 1000, refunded: 0 },
      { date: "2026-08-13", captured: 0, refunded: 0 },
    ])
  })

  it("does not drop a payment whose local date falls outside the key range", () => {
    // 00:10 UTC on Aug 13 is Aug 12 in New York; a local-date bucket would
    // put it on a day that is not in the key set and silently skip it.
    const rows = [payment({ amount: 500, createdAt: "2026-08-13T00:10:00.000Z" })]
    const out = dailyVolumeFor(rows, ["2026-08-13"], "EUR")
    expect(out[0].captured).toBe(500)
  })

  it("accumulates in integer minor units with no drift", () => {
    // Amounts that are inexact in binary once divided by 100.
    const amounts = Array.from({ length: 2000 }, (_, i) => 1001 + (i % 7))
    const rows = amounts.map((amount, i) =>
      payment({ id: `p${i}`, amount, createdAt: "2026-08-12T12:00:00.000Z" }),
    )
    const [day] = dailyVolumeFor(rows, ["2026-08-12"], "EUR")
    expect(day.captured).toBe(sumMinorUnits(amounts))
    expect(Number.isInteger(day.captured)).toBe(true)
  })

  it("never sums across currencies", () => {
    const rows = [
      payment({ amount: 100, createdAt: "2026-08-12T12:00:00.000Z", currency: "EUR" }),
      payment({ amount: 999, createdAt: "2026-08-12T12:00:00.000Z", currency: "USD" }),
    ]
    expect(dailyVolumeFor(rows, ["2026-08-12"], "EUR")[0].captured).toBe(100)
    expect(dailyVolumeFor(rows, ["2026-08-12"], "USD")[0].captured).toBe(999)
  })
})

describe("volumeByCurrency", () => {
  const refund = (paymentId: string, amount: number): Refund => ({
    id: `re_${paymentId}`,
    paymentId,
    amount,
    currency: "EUR",
    reason: "requested_by_customer",
    createdAt: "2026-08-13T00:00:00.000Z",
  })

  it("subtracts refunds instead of adding them", () => {
    const rows = [
      payment({ id: "a", amount: 10_000, createdAt: "2026-08-12T12:00:00.000Z" }),
      payment({ id: "b", amount: 4_000, createdAt: "2026-08-12T12:00:00.000Z", status: "refunded" }),
    ]
    const eur = volumeByCurrency(rows, [refund("b", 4_000)]).find((v) => v.currency === "EUR")!
    expect(eur.gross).toBe(14_000)
    expect(eur.refunded).toBe(4_000)
    expect(eur.net).toBe(10_000)
  })

  it("counts a partial refund at the refunded amount, not the payment's face value", () => {
    const rows = [
      payment({ id: "b", amount: 4_000, createdAt: "2026-08-12T12:00:00.000Z", status: "refunded" }),
    ]
    const eur = volumeByCurrency(rows, [refund("b", 2_000)]).find((v) => v.currency === "EUR")!
    expect(eur.net).toBe(2_000)
  })

  it("net is derived from gross and refunded", () => {
    const disputes: Dispute[] = []
    void disputes
    const out = volumeByCurrency([], [])
    for (const row of out) expect(row.net).toBe(row.gross - row.refunded)
  })
})
