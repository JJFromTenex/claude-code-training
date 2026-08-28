import { describe, expect, it } from "vitest"
import { dailyVolume, headlineMetrics } from "./metrics"
import { store } from "./store"
import { CURRENCIES } from "./types"

/**
 * These metrics used to sum payment.amount across currencies and label the
 * total USD, which produces a number that looks plausible while being
 * wrong. These tests pin the fix: every currency bucket is always present
 * on a day, and an amount in one currency never lands in another's bucket.
 */

describe("dailyVolume", () => {
  it("has every currency key present and zero on a day with no activity", () => {
    // Seed data only covers the 120 days before GENERATED_AT, so asking for
    // more days than that reaches back into days nobody was ever charged in.
    const days = dailyVolume(200)
    const idleDay = days[0]

    for (const currency of CURRENCIES) {
      expect(idleDay.captured[currency]).toBe(0)
      expect(idleDay.refunded[currency]).toBe(0)
    }
  })

  it("keeps each currency in its own bucket instead of adding them together", () => {
    const days = dailyVolume(120)
    const activeDay = days.find((day) =>
      CURRENCIES.some((currency) => day.captured[currency] > 0),
    )
    expect(activeDay).toBeDefined()

    for (const currency of CURRENCIES) {
      const expected = store.payments
        .filter(
          (p) =>
            p.status === "captured" &&
            p.currency === currency &&
            p.createdAt.slice(0, 10) === activeDay!.date,
        )
        .reduce((sum, p) => sum + p.amount, 0)
      expect(activeDay!.captured[currency]).toBe(expected)
    }
  })
})

describe("headlineMetrics", () => {
  it("reports gross volume and disputed amount as a record covering every currency", () => {
    const metrics = headlineMetrics()

    for (const currency of CURRENCIES) {
      expect(typeof metrics.grossVolume[currency]).toBe("number")
      expect(typeof metrics.disputedAmount[currency]).toBe("number")
    }
  })

  it("never adds one currency's captured or refunded total into another's", () => {
    const metrics = headlineMetrics()

    for (const currency of CURRENCIES) {
      const expected = store.payments
        .filter(
          (p) =>
            (p.status === "captured" || p.status === "refunded") &&
            p.currency === currency,
        )
        .reduce((sum, p) => sum + p.amount, 0)
      expect(metrics.grossVolume[currency]).toBe(expected)
    }
  })
})
