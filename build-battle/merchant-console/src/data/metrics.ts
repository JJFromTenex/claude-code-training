import { lastUtcDays, utcDayKey } from "@/lib/dates"
import { GENERATED_AT } from "./generate"
import { store } from "./store"

/**
 * Dashboard metrics, in integer minor units.
 *
 * KNOWN LIMITATION: the headline figures add USD, EUR, and GBP amounts
 * together without converting, and the overview renders the result with a
 * dollar sign. The number is a mixed-currency total, not a USD one, and it
 * overstates nothing and understates nothing consistently — it is simply not
 * a currency. Summing across currencies breaks the money rule; the fix needs
 * either an FX source or per-currency reporting, and neither is in scope here.
 * Do not build on these two fields until that is resolved.
 */

export interface DailyVolume {
  /** UTC calendar day, YYYY-MM-DD. */
  date: string
  /** Integer minor units. */
  captured: number
  /** Integer minor units. */
  refunded: number
}

export function dailyVolume(days = 30): DailyVolume[] {
  const keys = lastUtcDays(days, GENERATED_AT)
  const buckets = new Map<string, DailyVolume>(
    keys.map((date) => [date, { date, captured: 0, refunded: 0 }]),
  )

  for (const payment of store.payments) {
    // Bucket by UTC calendar day. The keys above are UTC, so reading the day
    // in server local time would file late-UTC payments under the wrong date
    // — or drop them off the oldest edge entirely.
    const bucket = buckets.get(utcDayKey(payment.createdAt))
    if (!bucket) continue

    // Minor units the whole way. An amount is never accumulated as a float.
    if (payment.status === "captured") {
      bucket.captured += payment.amount
    }
    if (payment.status === "refunded") {
      bucket.refunded += payment.amount
    }
  }

  return keys.map((date) => buckets.get(date)!)
}

export function headlineMetrics() {
  const captured = store.payments.filter((p) => p.status === "captured")
  const refunded = store.payments.filter((p) => p.status === "refunded")

  // Gross volume is everything that moved through the platform.
  // Mixed currency — see the limitation at the top of this file.
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
