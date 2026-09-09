import { afterAll, beforeAll, describe, expect, it } from "vitest"
import { Payment } from "./types"
import { dailyVolume, headlineMetrics } from "./metrics"

/** Bucketing is UTC and amounts are integer minor units. Both were quietly
 * untrue here before NWP-201. */

const payment = (over: Partial<Payment>): Payment => ({
  id: "pay_000001",
  merchantId: "mch_01",
  amount: 1000,
  currency: "USD",
  status: "captured",
  method: "card",
  cardBrand: "visa",
  last4: "4242",
  createdAt: "2026-08-13T12:00:00.000Z",
  description: "Online order",
  ...over,
})

describe("dailyVolume", () => {
  // GENERATED_AT is 2026-08-13T00:00:00Z, so day one of the window is the 13th.
  const original = process.env.TZ
  beforeAll(() => {
    // A host ahead of UTC. Under a local calendar key, 23:30Z on the 12th
    // reads as the 13th in Tokyo and the payment lands in the wrong bucket.
    process.env.TZ = "Asia/Tokyo"
  })
  afterAll(() => {
    process.env.TZ = original
  })

  it("buckets by the UTC day, not the server's local one", () => {
    const [day] = dailyVolume(1, [
      payment({ createdAt: "2026-08-13T23:30:00.000Z", amount: 4200 }),
    ])
    expect(day.date).toBe("2026-08-13")
    expect(day.captured).toBe(4200)
  })

  it("keeps minor units exact and separates captured from refunded", () => {
    // 0.01 + 0.02 in major units is 0.030000000000000006. In minor units it
    // is 3, every time.
    const [day] = dailyVolume(1, [
      payment({ amount: 1 }),
      payment({ amount: 2, id: "pay_000002" }),
      payment({ amount: 250, status: "refunded", id: "pay_000003" }),
    ])
    expect(day).toMatchObject({ captured: 3, refunded: 250 })
  })
})

describe("headlineMetrics", () => {
  it("counts captured money only, so a refund does not inflate gross volume", () => {
    const metrics = headlineMetrics(
      [
        payment({ amount: 1000 }),
        payment({ amount: 2000, id: "pay_000002" }),
        payment({ amount: 5000, status: "refunded", id: "pay_000003" }),
      ],
      [],
    )
    expect(metrics.grossVolume).toBe(3000)
  })
})
