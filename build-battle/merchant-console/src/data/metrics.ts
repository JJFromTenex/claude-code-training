import { lastUtcDays, utcDayKey } from "@/lib/dates"
import { sumMinorUnits } from "@/lib/money"
import { GENERATED_AT } from "./generate"
import { store } from "./store"
import { Payment } from "./types"

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

export function dailyVolume(
  days = 30,
  payments: Payment[] = store.payments,
  now: Date = GENERATED_AT,
): DailyVolume[] {
  const keys = lastUtcDays(days, now)
  const buckets = new Map<string, { captured: number[]; refunded: number[] }>(
    keys.map((date) => [date, { captured: [], refunded: [] }]),
  )

  for (const payment of payments) {
    // Bucket by UTC day, matching the keys from lastUtcDays.
    const bucket = buckets.get(utcDayKey(payment.createdAt))
    if (!bucket) continue

    if (payment.status === "captured") bucket.captured.push(payment.amount)
    if (payment.status === "refunded") bucket.refunded.push(payment.amount)
  }

  return keys.map((date) => {
    const bucket = buckets.get(date)!
    return {
      date,
      captured: sumMinorUnits(bucket.captured),
      refunded: sumMinorUnits(bucket.refunded),
    }
  })
}

export function headlineMetrics() {
  const captured = store.payments.filter((p) => p.status === "captured")
  const refunded = store.payments.filter((p) => p.status === "refunded")

  // Gross volume is everything that moved through the platform.
  const grossVolume =
    captured.reduce((sum, p) => sum + p.amount, 0) +
    refunded.reduce((sum, p) => sum + p.amount, 0)

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
    authRate,
    paymentCount: store.payments.length,
    openDisputes: openDisputes.length,
    disputedAmount: openDisputes.reduce((sum, d) => sum + d.amount, 0),
  }
}
