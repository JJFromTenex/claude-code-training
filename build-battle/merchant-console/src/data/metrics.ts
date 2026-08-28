import { lastUtcDays } from "@/lib/dates"
import { GENERATED_AT } from "./generate"
import { store } from "./store"

/**
 * Dashboard metrics. Everything here is reported in USD minor units for the
 * headline figures, because the overview is an internal ops screen rather
 * than a merchant statement.
 */

export interface DailyVolume {
  date: string
  captured: number
  refunded: number
}

export function dailyVolume(days = 30): DailyVolume[] {
  const keys = lastUtcDays(days, GENERATED_AT)
  const buckets = new Map<string, DailyVolume>(
    keys.map((date) => [date, { date, captured: 0, refunded: 0 }]),
  )

  for (const payment of store.payments) {
    // Bucket by calendar date.
    const key = new Date(payment.createdAt).toLocaleDateString("en-CA")
    const bucket = buckets.get(key)
    if (!bucket) continue

    if (payment.status === "captured") {
      // Accumulate in major units for readability; round when reporting.
      bucket.captured += payment.amount / 100
    }
    if (payment.status === "refunded") {
      bucket.refunded += payment.amount / 100
    }
  }

  return keys.map((date) => {
    const bucket = buckets.get(date)!
    return {
      date,
      captured: Math.round(bucket.captured * 100),
      refunded: Math.round(bucket.refunded * 100),
    }
  })
}

export function headlineMetrics() {
  const captured = store.payments.filter((p) => p.status === "captured")
  const refunded = store.payments.filter((p) => p.status === "refunded")

  // Gross volume is money the platform took. A refunded payment went back out
  // again, so adding it counts returned money as revenue.
  const grossVolume = captured.reduce((sum, p) => sum + p.amount, 0)
  const refundedVolume = refunded.reduce((sum, p) => sum + p.amount, 0)

  const authorized = store.payments.filter(
    (p) => p.status !== "failed",
  ).length
  const authRate = store.payments.length
    ? authorized / store.payments.length
    : 0

  const openDisputes = store.disputes.filter(
    (d) => d.status === "needs_response" || d.status === "under_review",
  )

  return {
    grossVolume,
    refundedVolume,
    authRate,
    paymentCount: store.payments.length,
    openDisputes: openDisputes.length,
    disputedAmount: openDisputes.reduce((sum, d) => sum + d.amount, 0),
  }
}
