import { describe, expect, it } from "vitest"
import { headlineMetrics } from "./metrics"
import { store } from "./store"

/**
 * A refunded payment came in and went back out. Counting it toward gross
 * volume reports money the platform returned as money it took, and the number
 * looks reasonable enough that nobody questions it.
 */

const sumOf = (status: string) =>
  store.payments
    .filter((payment) => payment.status === status)
    .reduce((total, payment) => total + payment.amount, 0)

describe("headlineMetrics", () => {
  it("has both captured and refunded payments to tell apart", () => {
    expect(sumOf("captured")).toBeGreaterThan(0)
    expect(sumOf("refunded")).toBeGreaterThan(0)
  })

  it("counts captured payments as gross volume", () => {
    expect(headlineMetrics().grossVolume).toBe(sumOf("captured"))
  })

  it("does not add refunds to gross volume", () => {
    expect(headlineMetrics().grossVolume).not.toBe(
      sumOf("captured") + sumOf("refunded"),
    )
  })

  it("reports refunded value separately, so it is not lost", () => {
    expect(headlineMetrics().refundedVolume).toBe(sumOf("refunded"))
  })

  it("keeps gross volume an integer number of minor units", () => {
    expect(Number.isInteger(headlineMetrics().grossVolume)).toBe(true)
  })
})
