import { lastUtcDays, utcDayKey } from "@/lib/dates"
import { GENERATED_AT } from "./generate"
import { sumMinorUnits } from "@/lib/money"
import { store } from "./store"
import { Dispute, Payment } from "./types"

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
): DailyVolume[] {
  const keys = lastUtcDays(days, GENERATED_AT)
  const buckets = new Map<string, DailyVolume>(
    keys.map((date) => [date, { date, captured: 0, refunded: 0 }]),
  )

  for (const payment of payments) {
    // Bucketing is UTC, so the key has to be built the same way lastUtcDays
    // builds it. A local calendar key silently misses on any non-UTC host.
    const bucket = buckets.get(utcDayKey(payment.createdAt))
    if (!bucket) continue

    // Minor units all the way through. There is no major-unit round trip.
    if (payment.status === "captured") bucket.captured += payment.amount
    if (payment.status === "refunded") bucket.refunded += payment.amount
  }

  return keys.map((date) => buckets.get(date)!)
}

export function headlineMetrics(
  payments: Payment[] = store.payments,
  disputes: Dispute[] = store.disputes,
) {
  const captured = payments.filter((p) => p.status === "captured")

  // Gross volume is money that was captured and stayed. A refunded payment
  // went back out; adding it in inflated the headline on the overview.
  const grossVolume = sumMinorUnits(captured.map((p) => p.amount))

  const authorized = payments.filter((p) => p.status !== "failed").length
  const authRate = payments.length ? authorized / payments.length : 0

  const openDisputes = disputes.filter(
    (d) => d.status === "needs_response" || d.status === "under_review",
  )

  return {
    grossVolume,
    authRate,
    paymentCount: payments.length,
    openDisputes: openDisputes.length,
    disputedAmount: openDisputes.reduce((sum, d) => sum + d.amount, 0),
  }
}
