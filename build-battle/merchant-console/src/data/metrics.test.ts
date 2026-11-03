// Run as if the server were on the US west coast. Set before any Date use so
// local-time conversions in the code under test pick it up.
process.env.TZ = "America/Los_Angeles"

import { describe, expect, it } from "vitest"
import { dailyVolume } from "./metrics"
import { Payment } from "./types"

/**
 * NWP-102. Daily volume must bucket by UTC day whatever the server's timezone,
 * and must total integer minor units without a float round-trip.
 */

const NOW = new Date("2026-03-15T12:00:00.000Z")

function payment(overrides: Partial<Payment>): Payment {
  return {
    id: "py_test",
    merchantId: "mer_test",
    amount: 100,
    currency: "USD",
    status: "captured",
    method: "card",
    cardBrand: "visa",
    last4: "4242",
    createdAt: "2026-03-15T00:00:00.000Z",
    description: "Test",
    ...overrides,
  }
}

describe("dailyVolume", () => {
  it("buckets a payment near midnight on its UTC day, not the server's", () => {
    // Guard: the process really is running behind UTC, or this test proves nothing.
    expect(new Date("2026-03-14T23:30:00.000Z").getDate()).toBe(14)
    expect(new Date("2026-03-15T00:15:00.000Z").getDate()).toBe(14)

    const volume = dailyVolume(
      2,
      [
        payment({ amount: 1000, createdAt: "2026-03-14T23:30:00.000Z" }),
        payment({ amount: 2500, createdAt: "2026-03-15T00:15:00.000Z" }),
      ],
      NOW,
    )

    expect(volume).toEqual([
      { date: "2026-03-14", captured: 1000, refunded: 0 },
      { date: "2026-03-15", captured: 2500, refunded: 0 },
    ])
  })

  it("totals exact integer minor units over many payments", () => {
    // 0.07 + 0.07 + ... drifts as a float; 7 + 7 + ... does not.
    const count = 10_001
    const payments = Array.from({ length: count }, (_, i) =>
      payment({
        id: `py_${i}`,
        amount: 7,
        status: i % 2 ? "refunded" : "captured",
      }),
    )

    const [today] = dailyVolume(1, payments, NOW)

    expect(today.captured).toBe(7 * 5001)
    expect(today.refunded).toBe(7 * 5000)
    expect(Number.isInteger(today.captured)).toBe(true)
    expect(Number.isInteger(today.refunded)).toBe(true)
  })
})
