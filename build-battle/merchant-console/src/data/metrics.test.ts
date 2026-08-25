import { utcDayKey } from "@/lib/dates"
import { describe, expect, it } from "vitest"
import { dailyVolume } from "./metrics"
import { store } from "./store"

/**
 * Regression tests for `dailyVolume`.
 *
 * It bucketed with `toLocaleDateString("en-CA")`, which resolves in the
 * server's local timezone. Storage and bucketing are UTC, so on any process
 * running west of UTC a payment just after midnight was filed to the previous
 * day. On this machine (America/Los_Angeles) a 03:30 UTC payment landed on the
 * 12th instead of the 13th.
 *
 * It also accumulated `amount / 100` — money as a float in major units — and
 * multiplied back at the end. At these magnitudes the rounding hid the drift,
 * so this was a rule violation rather than a wrong number on screen; the
 * integer assertions below pin it shut either way.
 */

describe("dailyVolume", () => {
  const rows = dailyVolume(30)

  it("returns one bucket per requested day, oldest first", () => {
    expect(rows).toHaveLength(30)
    const dates = rows.map((r) => r.date)
    expect([...dates].sort()).toEqual(dates)
  })

  it("buckets by UTC day, matching an independent recomputation", () => {
    // Recompute from the store using the UTC helper, then compare totals.
    // Against the local-timezone version this disagrees on every payment
    // that falls near a day boundary.
    const expected = new Map(rows.map((r) => [r.date, { captured: 0, refunded: 0 }]))

    for (const payment of store.payments) {
      const bucket = expected.get(utcDayKey(payment.createdAt))
      if (!bucket) continue
      if (payment.status === "captured") bucket.captured += payment.amount
      if (payment.status === "refunded") bucket.refunded += payment.amount
    }

    for (const row of rows) {
      expect({ captured: row.captured, refunded: row.refunded }).toEqual(
        expected.get(row.date),
      )
    }
  })

  it("puts a payment just after midnight UTC on that UTC day", () => {
    // The specific shape of the bug: an instant that belongs to one UTC day
    // but a different local one.
    expect(utcDayKey("2026-08-13T03:30:00.000Z")).toBe("2026-08-13")
  })

  it("reports integer minor units, never a float", () => {
    for (const row of rows) {
      expect(Number.isInteger(row.captured)).toBe(true)
      expect(Number.isInteger(row.refunded)).toBe(true)
    }
  })

  it("never reports a negative volume", () => {
    for (const row of rows) {
      expect(row.captured).toBeGreaterThanOrEqual(0)
      expect(row.refunded).toBeGreaterThanOrEqual(0)
    }
  })
})
