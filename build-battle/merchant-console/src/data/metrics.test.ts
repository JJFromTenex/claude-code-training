import { describe, expect, it } from "vitest"
import { lastUtcDays, utcDayKey } from "@/lib/dates"
import { GENERATED_AT } from "./generate"
import { dailyVolume } from "./metrics"
import { store } from "./store"

/**
 * Importing the store runs the deterministic seed anchored at GENERATED_AT,
 * so these expectations are the same on every machine.
 *
 * Two rules are under test: buckets are keyed in UTC, and amounts accumulate
 * as integer minor units.
 */

const DAYS = 30
const keys = lastUtcDays(DAYS, GENERATED_AT)

function expectedSums(status: "captured" | "refunded") {
  const sums = new Map<string, number>(keys.map((date) => [date, 0]))
  for (const payment of store.payments) {
    if (payment.status !== status) continue
    const key = utcDayKey(payment.createdAt)
    if (!sums.has(key)) continue
    sums.set(key, sums.get(key)! + payment.amount)
  }
  return sums
}

describe("dailyVolume", () => {
  it("matches an independent integer sum keyed by UTC day", () => {
    const captured = expectedSums("captured")
    const refunded = expectedSums("refunded")

    for (const row of dailyVolume(DAYS)) {
      expect(row.captured).toBe(captured.get(row.date))
      expect(row.refunded).toBe(refunded.get(row.date))
    }
  })

  it("returns exactly the last 30 UTC day keys, oldest first", () => {
    expect(dailyVolume(DAYS).map((row) => row.date)).toEqual(keys)
  })

  it("totals the captured payments whose UTC day falls in the window", () => {
    // Keying by the server's local calendar date shifts payments near
    // midnight into a neighbouring day, or out of the window entirely, so
    // this total only comes out right on a UTC machine and by luck.
    const inWindow = new Set(keys)
    const expected = store.payments
      .filter(
        (p) => p.status === "captured" && inWindow.has(utcDayKey(p.createdAt)),
      )
      .reduce((total, p) => total + p.amount, 0)

    const actual = dailyVolume(DAYS).reduce((total, r) => total + r.captured, 0)
    expect(actual).toBe(expected)
  })

  it("reports every bucket as integer minor units", () => {
    for (const row of dailyVolume(DAYS)) {
      expect(Number.isInteger(row.captured)).toBe(true)
      expect(Number.isInteger(row.refunded)).toBe(true)
    }
  })
})
