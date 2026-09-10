import { describe, expect, it } from "vitest"
import { dailyVolume } from "./metrics"
import { GENERATED_AT } from "./generate"
import { store } from "./store"

/**
 * Pre-existing defect found while building NWP-201: `dailyVolume` bucketed
 * with `toLocaleDateString`, the server's local calendar day, instead of the
 * UTC day the rest of the app uses. A payment at 2026-08-13T23:30Z landed in
 * the 08-14 bucket on any host west of UTC and was dropped if it fell before
 * the first requested day. Fixed to bucket on the UTC day key and to
 * accumulate integer minor units rather than dividing along the way.
 */

describe("dailyVolume", () => {
  it("buckets a late-UTC-day payment into its own UTC day, not the next one", () => {
    const before = store.payments.length
    store.payments.push({
      id: "pay_utc_edge",
      merchantId: "mch_01",
      amount: 12345,
      currency: "USD",
      status: "captured",
      method: "card",
      cardBrand: "visa",
      last4: "4242",
      createdAt: GENERATED_AT.toISOString().slice(0, 10) + "T23:30:00.000Z",
      description: "utc edge",
    })

    try {
      const days = dailyVolume(1)
      expect(days).toHaveLength(1)
      expect(days[0].date).toBe(GENERATED_AT.toISOString().slice(0, 10))
      expect(days[0].captured).toBeGreaterThanOrEqual(12345)
    } finally {
      store.payments.length = before
    }
  })

  it("returns integer minor units with no float drift", () => {
    for (const day of dailyVolume(30)) {
      expect(Number.isInteger(day.captured)).toBe(true)
      expect(Number.isInteger(day.refunded)).toBe(true)
    }
  })
})
