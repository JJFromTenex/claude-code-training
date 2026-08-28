import { describe, expect, it } from "vitest"
import { lastUtcDays, utcDayKey } from "@/lib/dates"
import { GENERATED_AT } from "./generate"
import { dailyVolume } from "./metrics"
import { store } from "./store"

/**
 * The daily volume chart is the first thing on the overview screen.
 *
 * Bucketing by the server's local day rather than the UTC day the keys are
 * built from does not lose money — it moves it to the wrong bar. The totals
 * still add up, so only a day-by-day check catches it.
 */

const DAYS = 30

/** What each UTC day should hold, in minor units, read straight off the store. */
function expectedByDay() {
  const keys = lastUtcDays(DAYS, GENERATED_AT)
  const buckets = new Map(
    keys.map((date) => [date, { date, captured: 0, refunded: 0 }]),
  )

  for (const payment of store.payments) {
    const bucket = buckets.get(utcDayKey(payment.createdAt))
    if (!bucket) continue
    if (payment.status === "captured") bucket.captured += payment.amount
    if (payment.status === "refunded") bucket.refunded += payment.amount
  }

  return keys.map((date) => buckets.get(date)!)
}

describe("dailyVolume", () => {
  it("puts each payment on its UTC day, not the server's", () => {
    expect(dailyVolume(DAYS)).toEqual(expectedByDay())
  })

  it("has payments in the hours where the two days disagree", () => {
    // Without these the test above passes on any timezone and proves nothing.
    const window = new Set(dailyVolume(DAYS).map((day) => day.date))
    const earlyHours = store.payments.filter(
      (p) =>
        Number(p.createdAt.slice(11, 13)) < 4 &&
        window.has(utcDayKey(p.createdAt)),
    )
    expect(earlyHours.length).toBeGreaterThan(0)
  })

  it("reports integer minor units", () => {
    for (const day of dailyVolume(DAYS)) {
      expect(Number.isInteger(day.captured)).toBe(true)
      expect(Number.isInteger(day.refunded)).toBe(true)
    }
  })

  it("covers the requested number of days, ending on the generation date", () => {
    const days = dailyVolume(DAYS)
    expect(days).toHaveLength(DAYS)
    expect(days.at(-1)?.date).toBe(utcDayKey(GENERATED_AT.toISOString()))
  })
})
