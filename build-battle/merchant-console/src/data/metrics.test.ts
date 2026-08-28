import { describe, expect, it } from "vitest"
import { utcDayKey } from "@/lib/dates"
import { dailyVolume } from "./metrics"
import { store } from "./store"

/**
 * Daily volume is what merchants read when they ask why yesterday looks
 * wrong, so the two ways it can lie are pinned here: a bucket keyed in the
 * server's timezone rather than UTC, and an amount accumulated as a float.
 *
 * The reconciliation below only disagrees on a machine that is not already
 * UTC, which is the point — a US-hosted server was putting every payment
 * before 05:00 UTC into the previous day.
 */

describe("dailyVolume", () => {
  it("reports whole minor units, so no amount is ever a float", () => {
    for (const day of dailyVolume(30)) {
      expect(Number.isInteger(day.captured)).toBe(true)
      expect(Number.isInteger(day.refunded)).toBe(true)
    }
  })

  it("buckets by the UTC day, not the server's day", () => {
    const days = dailyVolume(30)
    const keys = new Set(days.map((day) => day.date))

    const expected = new Map<string, number>()
    for (const payment of store.payments) {
      if (payment.status !== "captured") continue
      const key = utcDayKey(payment.createdAt)
      if (!keys.has(key)) continue
      expected.set(key, (expected.get(key) ?? 0) + payment.amount)
    }

    for (const day of days) {
      expect(day.captured).toBe(expected.get(day.date) ?? 0)
    }
  })

  it("returns one bucket per day asked for, oldest first", () => {
    const days = dailyVolume(30)
    expect(days).toHaveLength(30)
    const dates = days.map((day) => day.date)
    expect([...dates].sort()).toEqual(dates)
  })
})
